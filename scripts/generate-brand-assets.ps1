Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$assetFolder = Join-Path $projectRoot "electron\assets"
$buildFolder = Join-Path $projectRoot "build"
$pngPath = Join-Path $assetFolder "breakveil-icon.png"
$icoPath = Join-Path $buildFolder "icon.ico"

New-Item -ItemType Directory -Force $assetFolder, $buildFolder | Out-Null

function New-RoundedRectanglePath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $Radius * 2
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

$size = 1024
$bitmap = New-Object System.Drawing.Bitmap $size, $size
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$graphics.Clear([System.Drawing.Color]::Transparent)

$outerPath = New-RoundedRectanglePath 32 32 960 960 230
$backgroundBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 16, 19, 27))
$graphics.FillPath($backgroundBrush, $outerPath)

$gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Point 110, 110),
  (New-Object System.Drawing.Point 900, 900),
  ([System.Drawing.Color]::FromArgb(255, 56, 189, 248)),
  ([System.Drawing.Color]::FromArgb(255, 139, 92, 246))
)
$borderPen = New-Object System.Drawing.Pen $gradient, 28
$graphics.DrawPath($borderPen, $outerPath)

$fontFamily = New-Object System.Drawing.FontFamily "Segoe UI"
$bPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$bPath.AddString("B", $fontFamily, [int][System.Drawing.FontStyle]::Bold, 520, (New-Object System.Drawing.PointF 178, 222), [System.Drawing.StringFormat]::GenericDefault)
$vPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$vPath.AddString("V", $fontFamily, [int][System.Drawing.FontStyle]::Bold, 500, (New-Object System.Drawing.PointF 475, 232), [System.Drawing.StringFormat]::GenericDefault)

$whiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 248, 250, 252))
$graphics.FillPath($whiteBrush, $bPath)
$graphics.FillPath($gradient, $vPath)

$breakPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 16, 19, 27)), 30
$breakPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$breakPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$graphics.DrawLine($breakPen, 610, 235, 515, 790)

$target = New-Object System.Drawing.Bitmap 256, 256
$targetGraphics = [System.Drawing.Graphics]::FromImage($target)
$targetGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$targetGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$targetGraphics.DrawImage($bitmap, 0, 0, 256, 256)
$target.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

$pngBytes = [System.IO.File]::ReadAllBytes($pngPath)
$stream = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter $stream
$writer.Write([uint16]0)
$writer.Write([uint16]1)
$writer.Write([uint16]1)
$writer.Write([byte]0)
$writer.Write([byte]0)
$writer.Write([byte]0)
$writer.Write([byte]0)
$writer.Write([uint16]1)
$writer.Write([uint16]32)
$writer.Write([uint32]$pngBytes.Length)
$writer.Write([uint32]22)
$writer.Write($pngBytes)
$writer.Flush()
[System.IO.File]::WriteAllBytes($icoPath, $stream.ToArray())

$writer.Dispose()
$stream.Dispose()
$targetGraphics.Dispose()
$target.Dispose()
$breakPen.Dispose()
$whiteBrush.Dispose()
$vPath.Dispose()
$bPath.Dispose()
$fontFamily.Dispose()
$borderPen.Dispose()
$gradient.Dispose()
$backgroundBrush.Dispose()
$outerPath.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

Write-Host "Generated BreakVeil icon assets."
