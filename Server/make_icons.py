from PIL import Image, ImageDraw, ImageFont
import os

out = r"..\Client\public\icons"
os.makedirs(out, exist_ok=True)
NAVY, GREEN = (30, 58, 95), (47, 143, 91)

def icone(taille, marge=0.0):
    im = Image.new("RGB", (taille, taille), NAVY)
    d = ImageDraw.Draw(im)
    m = int(taille * marge)
    d.ellipse([m + taille*0.12, m + taille*0.12, taille - m - taille*0.12, taille - m - taille*0.12], fill=GREEN)
    try:
        f = ImageFont.truetype("arialbd.ttf", int(taille * 0.42))
    except OSError:
        f = ImageFont.load_default()
    d.text((taille/2, taille/2), "S", fill="white", font=f, anchor="mm")
    return im

icone(192).save(os.path.join(out, "icon-192.png"))
icone(512).save(os.path.join(out, "icon-512.png"))
icone(512, 0.08).save(os.path.join(out, "icon-maskable-512.png"))
icone(180).save(os.path.join(out, "apple-touch-icon.png"))
print("Icônes créées")