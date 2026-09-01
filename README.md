# Klangbild

Ein Musik-Visualisierer im Browser – ohne Installation, ohne Build-Tools.

## Funktionen

- **Quellen:** Audio-/Videodateien (MP3, WAV, OGG, MP4) per Drag & Drop oder Dateiauswahl,
  außerdem **System-Audio** (alles, was gerade am PC läuft).
- **Vier Visualisierungen:**
  - **Klassisch** – Frequenz-Balken mit Wellenform
  - **Partikel** – generatives Partikelsystem, das auf Beats und Tonlage reagiert
  - **3D** – Three.js-Szene mit Frequenz-Ring und pulsierendem Kern
  - **Klangbild** – der ganze Song als ein statisches Bild (Kreis-Fingerabdruck oder
    Spektrogramm), exportierbar als PNG

Die Musik wird ausschließlich lokal im Browser verarbeitet – nichts wird hochgeladen.

## Starten

Die App braucht nur einen statischen Webserver (ES-Module funktionieren nicht über `file://`):

```
# z. B. mit Python
python -m http.server 8080
```

Dann http://localhost:8080 öffnen. Alternativ den Ordner in XAMPP/htdocs legen
oder über GitHub Pages veröffentlichen.

## Hinweise

- **System-Audio:** Funktioniert in Chrome/Edge. Beim Klick auf „System-Audio" einen
  Tab oder den gesamten Bildschirm teilen und dabei **„Audio teilen" ankreuzen**.
- **Statisches Klangbild:** Braucht eine geladene Datei (der ganze Song wird analysiert),
  mit System-Audio ist es nicht verfügbar.
- Three.js wird per CDN geladen (Version 0.160.0, gepinnt) – für den 3D-Modus ist
  daher eine Internetverbindung nötig.
