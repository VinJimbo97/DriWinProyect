# Genera el ícono de DriWin (public/icon.ico + public/icon.png) desde el logo DW.
# Recorta solo el cuadrado del logo (sin el brillo exterior, que a 16-32 px se ve borroso)
# y crea un .ico con los tamaños que usa Windows (16 a 256 px).
#
# Uso, desde app-inicio-windows:
#   .\branding\make-icon.ps1 -Source branding\logo-dw-original.png -OutIco public\icon.ico -OutPng public\icon.png
#
# Si cambias el logo, ajusta el recorte ($crop): son los bordes del cuadrado oscuro en la imagen.
param([string]$Source, [string]$OutIco, [string]$OutPng)
Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Bitmap]::FromFile($Source)
$crop = New-Object System.Drawing.Rectangle 67, 67, 466, 449
$sizes = 256, 128, 64, 48, 32, 24, 16
$pngs = @()

foreach ($s in $sizes) {
  $bmp = New-Object System.Drawing.Bitmap $s, $s, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $attrs = New-Object System.Drawing.Imaging.ImageAttributes
  $attrs.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $s, $s), $crop.X, $crop.Y, $crop.Width, $crop.Height, [System.Drawing.GraphicsUnit]::Pixel, $attrs)
  $g.Dispose()
  if ($s -eq 256) { $bmp.Save($OutPng, [System.Drawing.Imaging.ImageFormat]::Png) }
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngs += , $ms.ToArray()
  $bmp.Dispose()
}
$src.Dispose()

# Formato ICO: cabecera + una entrada por tamaño + las imágenes PNG
$out = New-Object System.IO.MemoryStream
$w = New-Object System.IO.BinaryWriter $out
$w.Write([UInt16]0); $w.Write([UInt16]1); $w.Write([UInt16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $s = $sizes[$i]; $dim = if ($s -ge 256) { 0 } else { $s }
  $w.Write([byte]$dim); $w.Write([byte]$dim); $w.Write([byte]0); $w.Write([byte]0)
  $w.Write([UInt16]1); $w.Write([UInt16]32)
  $w.Write([UInt32]$pngs[$i].Length); $w.Write([UInt32]$offset)
  $offset += $pngs[$i].Length
}
foreach ($p in $pngs) { $w.Write($p) }
$w.Flush()
[System.IO.File]::WriteAllBytes($OutIco, $out.ToArray())
"OK: $OutIco ($($out.Length) bytes)"
