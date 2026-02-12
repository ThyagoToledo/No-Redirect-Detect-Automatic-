Add-Type -AssemblyName System.Drawing

function New-ShieldIcon {
    param(
        [int]$iconSize,
        [string]$outputPath
    )
    
    $bmp = New-Object System.Drawing.Bitmap($iconSize, $iconSize)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.PixelOffsetMode = 'HighQuality'
    $g.InterpolationMode = 'HighQualityBicubic'
    
    $g.Clear([System.Drawing.Color]::Transparent)
    
    $sc = $iconSize / 128.0
    $padVal = [int](10 * $sc)
    
    $shieldPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $cx = $iconSize / 2
    $topY = $padVal
    $botY = $iconSize - $padVal
    $leftX = $padVal + [int](8 * $sc)
    $rightX = $iconSize - $padVal - [int](8 * $sc)
    $midY = $topY + [int](($botY - $topY) * 0.55)
    
    $shieldPath.AddLine($cx, $topY, $rightX, [int]($topY + 18 * $sc))
    $shieldPath.AddLine($rightX, [int]($topY + 18 * $sc), $rightX, $midY)
    $shieldPath.AddBezier($rightX, $midY, $rightX, [int]($midY + 25 * $sc), $cx, [int]($botY - 5 * $sc), $cx, $botY)
    $shieldPath.AddBezier($cx, $botY, $cx, [int]($botY - 5 * $sc), $leftX, [int]($midY + 25 * $sc), $leftX, $midY)
    $shieldPath.AddLine($leftX, $midY, $leftX, [int]($topY + 18 * $sc))
    $shieldPath.CloseFigure()
    
    $green = [System.Drawing.Color]::FromArgb(255, 16, 185, 129)
    $darkGreen = [System.Drawing.Color]::FromArgb(255, 5, 150, 105)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.PointF(0, $topY)),
        (New-Object System.Drawing.PointF(0, $botY)),
        $green, $darkGreen)
    $g.FillPath($brush, $shieldPath)
    
    $penWidth = [Math]::Max(1, [int](8 * $sc))
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, $penWidth)
    $pen.StartCap = 'Round'
    $pen.EndCap = 'Round'
    $pen.LineJoin = 'Round'
    
    $cx1 = [int]($cx - 18 * $sc)
    $cy1 = [int]($cx + 2 * $sc)
    $cx2 = [int]($cx - 4 * $sc)
    $cy2 = [int]($cx + 16 * $sc)
    $cx3 = [int]($cx + 20 * $sc)
    $cy3 = [int]($cx - 14 * $sc)
    
    $g.DrawLine($pen, $cx1, $cy1, $cx2, $cy2)
    $g.DrawLine($pen, $cx2, $cy2, $cx3, $cy3)
    
    $pen.Dispose()
    $brush.Dispose()
    $g.Dispose()
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Created: $outputPath"
}

$basePath = Join-Path $PSScriptRoot "icons"
New-ShieldIcon -iconSize 16 -outputPath "$basePath\icon16.png"
New-ShieldIcon -iconSize 48 -outputPath "$basePath\icon48.png"
New-ShieldIcon -iconSize 128 -outputPath "$basePath\icon128.png"
Write-Host "All icons created!"
