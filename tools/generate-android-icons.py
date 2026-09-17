"""Erzeugt Launcher- und Splash-Grafiken fuer die Android-App.

Gleiches Motiv wie das PWA-Icon, damit App und Website gleich aussehen.
Ein eigener PNG-Schreiber, weil in dieser Umgebung keine Bildbibliothek liegt.
"""
import zlib, struct, math, os

BG = (0x11, 0x16, 0x1f)
RING = (0x46, 0x53, 0x6b)
CORE = (0x4c, 0xc2, 0xff)
OUTLINE = (0xe8, 0xf6, 0xff)

def png(path, width, height, pixel):
    rows = bytearray()
    for y in range(height):
        rows.append(0)
        for x in range(width):
            rows.extend(pixel(x, y))
    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))
    out = b"\x89PNG\r\n\x1a\n"
    out += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    out += chunk(b"IDAT", zlib.compress(bytes(rows), 9))
    out += chunk(b"IEND", b"")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "wb").write(out)

def emblem(size, motif=1.0, background=BG):
    c = size / 2.0
    r_core = size * 0.16 * motif
    r_out = size * 0.34 * motif
    r_in = size * 0.27 * motif
    edge = max(2.0, size * 0.012 * motif)
    def pixel(x, y):
        dx = x + 0.5 - c
        dy = y + 0.5 - c
        d = math.hypot(dx, dy)
        if d <= r_core:
            return CORE
        if d <= r_core + edge:
            return OUTLINE
        if r_in <= d <= r_out:
            a = (math.atan2(dy, dx) + math.pi) % (math.pi / 2)
            return background if a < 0.30 else RING
        return background
    return pixel

RES = "android/app/src/main/res"

# Launcher-Icons: volles Motiv auf dunklem Grund.
for folder, size in [("mipmap-mdpi", 48), ("mipmap-hdpi", 72), ("mipmap-xhdpi", 96),
                     ("mipmap-xxhdpi", 144), ("mipmap-xxxhdpi", 192)]:
    for name in ["ic_launcher.png", "ic_launcher_round.png"]:
        png(f"{RES}/{folder}/{name}", size, size, emblem(size))

# Adaptive Icons: Android beschneidet den Rand, deshalb kleineres Motiv.
for folder, size in [("mipmap-mdpi", 108), ("mipmap-hdpi", 162), ("mipmap-xhdpi", 216),
                     ("mipmap-xxhdpi", 324), ("mipmap-xxxhdpi", 432)]:
    png(f"{RES}/{folder}/ic_launcher_foreground.png", size, size, emblem(size, 0.52))

# Splash: Motiv in der Mitte eines dunklen Rechtecks.
def splash(width, height):
    side = min(width, height)
    motif = emblem(side, 0.85)
    ox = (width - side) // 2
    oy = (height - side) // 2
    def pixel(x, y):
        if ox <= x < ox + side and oy <= y < oy + side:
            return motif(x - ox, y - oy)
        return BG
    return pixel

sizes = {"mdpi": (320, 480), "hdpi": (480, 800), "xhdpi": (720, 1280),
         "xxhdpi": (960, 1600), "xxxhdpi": (1280, 1920)}
for density, (w, h) in sizes.items():
    png(f"{RES}/drawable-port-{density}/splash.png", w, h, splash(w, h))
    png(f"{RES}/drawable-land-{density}/splash.png", h, w, splash(h, w))
png(f"{RES}/drawable/splash.png", 480, 320, splash(480, 320))
print("Grafiken erzeugt")
