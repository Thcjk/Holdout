"""
Wandelt die Kenney-3D-Assets einmalig in GLB-Dateien fuer das Spiel um.

WARUM ES DIESES SKRIPT GIBT
---------------------------
Das hochgeladene Paket enthaelt KEINE GLB-Dateien, sondern:

  - die Figuren nur als Blender-2.79-Dateien (public/Source/character*.blend)
  - die Animationen nur als Blender-Dateien (Source/*.blend)
  - Kisten, Waffen, Munition als FBX (public/*.fbx)

Three.js kann weder .blend lesen noch FBX gut (FBX geht, aber langsam und
gross). GLB ist das Format, fuer das Three.js gebaut ist. Umgewandelt wird
hier EINMAL beim Entwickeln; ins Spiel kommen nur die fertigen GLBs unter
public/models/.

AUSFUEHREN
----------
Blender gibt es als Python-Modul (bpy) auf PyPI - ein installiertes Blender
braucht es nicht:

    python3.11 -m venv .bpy && .bpy/bin/pip install "bpy==4.2.*"
    .bpy/bin/python tools/convert-models.py

Danach die Haeute rastern: `node tools/rasterize-skins.mjs` (siehe dort).

ZWEI FALLEN, DIE HIER ABGEFANGEN WERDEN
---------------------------------------
1. Das Skelett arbeitet mit IK-Steuerknochen: Die Animationen bewegen
   Fussziele und Hilfsknochen, die eigentlichen Beinknochen folgen ueber
   Einschraenkungen (Constraints). glTF kennt keine Constraints. Deshalb
   wird jede Animation Bild fuer Bild "eingebacken" (force_sampling) und nur
   die verformenden Knochen exportiert (def_bones) - im Spiel steht dann das
   Ergebnis, nicht die Rechnung.
2. "Run" ist mit 24 Bildern je Sekunde animiert, alle anderen mit 30. Eine
   gemeinsame Datei haette nur EINE Bildrate - Rennen liefe dann zu schnell.
   Deshalb wird jede Animation aus ihrer eigenen Datei mit deren Bildrate
   exportiert. Im Spiel werden die Clips ueber die Knochennamen verbunden;
   alle Dateien haben dasselbe Skelett (45 Knochen, gleiche Namen).
"""

import os
import sys

import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "public", "models")

# Koerper: Quelldatei -> Name im Spiel.
BODIES = {
    "public/Source/characterMedium.blend": "body-medium",
    "public/Source/characterSmall.blend": "body-small",
    "public/Source/characterLargeMale.blend": "body-large-male",
    "public/Source/characterLargeFemale.blend": "body-large-female",
}

# Animationen: Quelldatei -> (Aktion in der Datei, Name im Spiel).
ANIMATIONS = {
    "Source/idle.blend": ("Idle", "idle"),
    "Source/run.blend": ("Run", "run"),
    "Source/walk.blend": ("Walk", "walk"),
    "Source/shoot.blend": ("Shoot", "shoot"),
    "Source/death.blend": ("Death", "death"),
    "Source/punch.blend": ("Punch", "punch"),
}

# FBX-Modelle: Quelle -> Name im Spiel. Nur was gebraucht wird.
PROPS = {
    "public/crate-small.fbx": "crate-small",
    "public/crate-medium.fbx": "crate-medium",
    "public/crate-wide.fbx": "crate-wide",
    "public/blaster-h.fbx": "loot-pistol",
    "public/blaster-b.fbx": "loot-smg",
    "public/blaster-e.fbx": "loot-rifle",
    "public/blaster-f.fbx": "loot-railgun",
    "public/clip-large.fbx": "loot-ammo",
    "public/target-fragment-large.fbx": "loot-scrap",
    "public/target-large.fbx": "deco-target",
    "public/smoke.fbx": "deco-smoke",
}

COLORMAP = os.path.join(ROOT, "public", "Textures", "colormap.png")


def export(path, animations):
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_skins=True,
        # Alle Knochen, auch die Steuerknochen: Koerper und Animationen muessen
        # exakt dieselbe Knochenliste haben, sonst finden die Clips ihre
        # Knochen nicht.
        export_def_bones=False,
        export_animations=animations,
        # "ACTIONS" exportiert jede Aktion unter ihrem Namen und mit ihrer
        # eigenen Laenge. Mit "ACTIVE_ACTIONS" kam ein Clip namens "Animation"
        # mit 0 Sekunden heraus - ausprobiert, nicht vermutet.
        export_animation_mode="ACTIONS",
        export_force_sampling=True,
        export_optimize_animation_size=True,
        export_morph=False,
        export_cameras=False,
        export_lights=False,
    )
    print("  ->", os.path.relpath(path, ROOT), f"{os.path.getsize(path) // 1024} KB")


def remove_helpers():
    """Steuerformen des Rigs (keine Geometrie, nur fuer Blender-Bedienung)."""
    for ob in list(bpy.data.objects):
        if ob.name.endswith("CtrlShape"):
            bpy.data.objects.remove(ob, do_unlink=True)


def convert_bodies():
    for source, name in BODIES.items():
        bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT, source))
        remove_helpers()
        # Die Haut-Textur zeigt auf einen Pfad, den es im Paket nicht gibt.
        # Die Haut setzt das Spiel selbst (eine Datei je Rolle) - im Modell
        # bleibt nur das Material ohne Bild.
        for material in bpy.data.materials:
            if material.use_nodes:
                for node in list(material.node_tree.nodes):
                    if node.type == "TEX_IMAGE":
                        material.node_tree.nodes.remove(node)
        for obj in bpy.data.objects:
            if obj.animation_data:
                obj.animation_data.action = None
        print(name)
        export(os.path.join(OUT, f"{name}.glb"), animations=False)


def convert_animations():
    for source, (action_name, name) in ANIMATIONS.items():
        bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT, source))
        remove_helpers()
        # Nur das Skelett exportieren - die Figur darin braucht es nicht.
        for ob in list(bpy.data.objects):
            if ob.type == "MESH":
                bpy.data.objects.remove(ob, do_unlink=True)
        arm = bpy.data.objects["Root"]
        action = bpy.data.actions[action_name]
        # Jede Datei enthaelt zusaetzlich eine leere "0.Targeting Pose" und
        # abgelegte Spuren - raus damit, sonst landen sie als Clips im Spiel.
        for other in list(bpy.data.actions):
            if other != action:
                bpy.data.actions.remove(other)
        arm.animation_data_create()
        for track in list(arm.animation_data.nla_tracks):
            arm.animation_data.nla_tracks.remove(track)
        action.name = name
        arm.animation_data.action = action
        start, end = action.frame_range
        print(name, f"{int(end - start)} Bilder @ {bpy.context.scene.render.fps} fps")
        export(os.path.join(OUT, f"anim-{name}.glb"), animations=True)


def convert_props():
    for source, name in PROPS.items():
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.fbx(filepath=os.path.join(ROOT, source))
        # Das Blaster Kit teilt sich eine Farbtabelle (colormap.png). Der
        # Pfad im FBX stimmt im hochgeladenen Ordner nicht - hier gerade biegen.
        for image in bpy.data.images:
            if "colormap" in image.name.lower() or "colormap" in image.filepath.lower():
                image.filepath = COLORMAP
                image.reload()
        has_animation = len(bpy.data.actions) > 0
        print(name, "Animationen:", [a.name for a in bpy.data.actions])
        export(os.path.join(OUT, f"{name}.glb"), animations=has_animation)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    which = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["bodies", "anims", "props"]
    if "bodies" in which:
        convert_bodies()
    if "anims" in which:
        convert_animations()
    if "props" in which:
        convert_props()
