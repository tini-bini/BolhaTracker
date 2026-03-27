Add-Type -AssemblyName System.Drawing

function New-RoundedRectPath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = [Math]::Min($Radius * 2, [Math]::Min($Width, $Height))

  if ($diameter -le 0) {
    $path.AddRectangle([System.Drawing.RectangleF]::new($X, $Y, $Width, $Height))
    return $path
  }

  $arc = [System.Drawing.RectangleF]::new($X, $Y, $diameter, $diameter)
  $path.AddArc($arc, 180, 90)
  $arc.X = $X + $Width - $diameter
  $path.AddArc($arc, 270, 90)
  $arc.Y = $Y + $Height - $diameter
  $path.AddArc($arc, 0, 90)
  $arc.X = $X
  $path.AddArc($arc, 90, 90)
  $path.CloseFigure()
  return $path
}

function Fill-RoundedRect {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Brush]$Brush,
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $path = New-RoundedRectPath -X $X -Y $Y -Width $Width -Height $Height -Radius $Radius
  try {
    $Graphics.FillPath($Brush, $path)
  }
  finally {
    $path.Dispose()
  }
}

function Draw-RoundedRect {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Pen]$Pen,
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $path = New-RoundedRectPath -X $X -Y $Y -Width $Width -Height $Height -Radius $Radius
  try {
    $Graphics.DrawPath($Pen, $path)
  }
  finally {
    $path.Dispose()
  }
}

function New-Point {
  param([float]$X, [float]$Y)
  return [System.Drawing.PointF]::new($X, $Y)
}

function Draw-Icon {
  param(
    [int]$Size,
    [string]$OutputPath
  )

  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

  $charcoalTop = [System.Drawing.Color]::FromArgb(255, 50, 53, 58)
  $charcoalBottom = [System.Drawing.Color]::FromArgb(255, 27, 30, 34)
  $charcoalDeep = [System.Drawing.Color]::FromArgb(255, 18, 20, 24)
  $sage = [System.Drawing.Color]::FromArgb(255, 117, 177, 131)
  $sageSoft = [System.Drawing.Color]::FromArgb(170, 196, 238, 206)
  $sageGlow = [System.Drawing.Color]::FromArgb(105, 117, 177, 131)
  $mintWhite = [System.Drawing.Color]::FromArgb(220, 237, 247, 240)
  $frost = [System.Drawing.Color]::FromArgb(124, 240, 248, 244)
  $frostEdge = [System.Drawing.Color]::FromArgb(145, 255, 255, 255)
  $tileEdge = [System.Drawing.Color]::FromArgb(40, 255, 255, 255)
  $shadow = [System.Drawing.Color]::FromArgb(90, 0, 0, 0)

  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $pad = [Math]::Max(1.0, $Size * 0.085)
    $tileSize = $Size - ($pad * 2)
    $radius = $tileSize * 0.28

    $shadowBrush = [System.Drawing.SolidBrush]::new($shadow)
    try {
      Fill-RoundedRect -Graphics $graphics -Brush $shadowBrush -X ($pad + ($Size * 0.01)) -Y ($pad + ($Size * 0.035)) -Width $tileSize -Height $tileSize -Radius $radius
    }
    finally {
      $shadowBrush.Dispose()
    }

    $tileBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
      (New-Point ($pad + $tileSize * 0.15) $pad),
      (New-Point ($pad + $tileSize * 0.85) ($pad + $tileSize)),
      $charcoalTop,
      $charcoalBottom
    )
    try {
      Fill-RoundedRect -Graphics $graphics -Brush $tileBrush -X $pad -Y $pad -Width $tileSize -Height $tileSize -Radius $radius
    }
    finally {
      $tileBrush.Dispose()
    }

    $clipPath = New-RoundedRectPath -X $pad -Y $pad -Width $tileSize -Height $tileSize -Radius $radius
    try {
      $graphics.SetClip($clipPath)

      $panelGlow = [System.Drawing.Drawing2D.PathGradientBrush]::new([System.Drawing.PointF[]] @(
        (New-Point ($pad + $tileSize * 0.18) ($pad + $tileSize * 0.08)),
        (New-Point ($pad + $tileSize * 0.86) ($pad + $tileSize * 0.15)),
        (New-Point ($pad + $tileSize * 0.68) ($pad + $tileSize * 0.64)),
        (New-Point ($pad + $tileSize * 0.22) ($pad + $tileSize * 0.56))
      ))
      try {
        $panelGlow.CenterColor = [System.Drawing.Color]::FromArgb(38, 255, 255, 255)
        $panelGlow.SurroundColors = @([System.Drawing.Color]::Transparent)
        $graphics.FillEllipse($panelGlow, $pad + $tileSize * 0.02, $pad - $tileSize * 0.02, $tileSize * 0.96, $tileSize * 0.62)
      }
      finally {
        $panelGlow.Dispose()
      }

      $greenGlow = [System.Drawing.Drawing2D.PathGradientBrush]::new([System.Drawing.PointF[]] @(
        (New-Point ($pad + $tileSize * 0.20) ($pad + $tileSize * 0.38)),
        (New-Point ($pad + $tileSize * 0.78) ($pad + $tileSize * 0.20)),
        (New-Point ($pad + $tileSize * 0.78) ($pad + $tileSize * 0.74)),
        (New-Point ($pad + $tileSize * 0.28) ($pad + $tileSize * 0.82))
      ))
      try {
        $greenGlow.CenterColor = $sageGlow
        $greenGlow.SurroundColors = @([System.Drawing.Color]::Transparent)
        $graphics.FillEllipse($greenGlow, $pad + $tileSize * 0.12, $pad + $tileSize * 0.18, $tileSize * 0.72, $tileSize * 0.68)
      }
      finally {
        $greenGlow.Dispose()
      }

      $causticBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        (New-Point $pad ($pad + $tileSize * 0.22)),
        (New-Point ($pad + $tileSize) ($pad + $tileSize * 0.48)),
        [System.Drawing.Color]::FromArgb(44, 255, 255, 255),
        [System.Drawing.Color]::FromArgb(0, 255, 255, 255)
      )
      try {
        $graphics.FillEllipse($causticBrush, $pad - $tileSize * 0.05, $pad + $tileSize * 0.04, $tileSize * 0.90, $tileSize * 0.34)
      }
      finally {
        $causticBrush.Dispose()
      }

      $graphics.ResetClip()
    }
    finally {
      $clipPath.Dispose()
    }

    $tilePen = [System.Drawing.Pen]::new($tileEdge, [Math]::Max(1.0, $Size * 0.012))
    try {
      Draw-RoundedRect -Graphics $graphics -Pen $tilePen -X ($pad + 0.5) -Y ($pad + 0.5) -Width ($tileSize - 1.0) -Height ($tileSize - 1.0) -Radius ($radius * 0.98)
    }
    finally {
      $tilePen.Dispose()
    }

    $glassPenWidth = [Math]::Max(2.0, $tileSize * 0.16)
    $innerPenWidth = [Math]::Max(1.2, $tileSize * 0.082)
    $points = [System.Drawing.PointF[]] @(
      (New-Point ($pad + $tileSize * 0.28) ($pad + $tileSize * 0.67)),
      (New-Point ($pad + $tileSize * 0.43) ($pad + $tileSize * 0.55)),
      (New-Point ($pad + $tileSize * 0.56) ($pad + $tileSize * 0.42)),
      (New-Point ($pad + $tileSize * 0.70) ($pad + $tileSize * 0.30))
    )

    $glassStroke = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $glassStroke.AddLines($points)

    try {
      $shadowGlassPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(32, 0, 0, 0), $glassPenWidth + ($tileSize * 0.02))
      $shadowGlassPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
      $shadowGlassPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
      $shadowGlassPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
      $shadowMatrix = [System.Drawing.Drawing2D.Matrix]::new()
      $shadowMatrix.Translate($Size * 0.01, $Size * 0.016)
      $shadowCopy = $glassStroke.Clone()
      $shadowCopy.Transform($shadowMatrix)
      try {
        $graphics.DrawPath($shadowGlassPen, $shadowCopy)
      }
      finally {
        $shadowCopy.Dispose()
        $shadowMatrix.Dispose()
        $shadowGlassPen.Dispose()
      }

      $glassPen = [System.Drawing.Pen]::new($frost, $glassPenWidth)
      $glassPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
      $glassPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
      $glassPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
      try {
        $graphics.DrawPath($glassPen, $glassStroke)
      }
      finally {
        $glassPen.Dispose()
      }

      $innerPen = [System.Drawing.Pen]::new($mintWhite, $innerPenWidth)
      $innerPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
      $innerPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
      $innerPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
      try {
        $graphics.DrawPath($innerPen, $glassStroke)
      }
      finally {
        $innerPen.Dispose()
      }
    }
    finally {
      $glassStroke.Dispose()
    }

    $barX = $pad + $tileSize * 0.22
    $barY = $pad + $tileSize * 0.31
    $barW = [Math]::Max(2.0, $tileSize * 0.11)
    $barH = $tileSize * 0.43
    $barBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
      (New-Point $barX $barY),
      (New-Point $barX ($barY + $barH)),
      [System.Drawing.Color]::FromArgb(124, 248, 252, 250),
      [System.Drawing.Color]::FromArgb(90, 212, 239, 219)
    )
    try {
      Fill-RoundedRect -Graphics $graphics -Brush $barBrush -X $barX -Y $barY -Width $barW -Height $barH -Radius ($barW / 2)
    }
    finally {
      $barBrush.Dispose()
    }

    $smallNodeRadius = [Math]::Max(1.2, $tileSize * 0.052)
    $nodeBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(116, 248, 252, 249))
    try {
      foreach ($point in $points[0..2]) {
        $graphics.FillEllipse($nodeBrush, $point.X - $smallNodeRadius, $point.Y - $smallNodeRadius, $smallNodeRadius * 2, $smallNodeRadius * 2)
      }
    }
    finally {
      $nodeBrush.Dispose()
    }

    $coreCenter = $points[3]
    $glowRadius = $tileSize * 0.20
    $coreGlow = [System.Drawing.Drawing2D.PathGradientBrush]::new([System.Drawing.PointF[]] @(
      (New-Point ($coreCenter.X - $glowRadius) $coreCenter.Y),
      (New-Point $coreCenter.X ($coreCenter.Y - $glowRadius)),
      (New-Point ($coreCenter.X + $glowRadius) $coreCenter.Y),
      (New-Point $coreCenter.X ($coreCenter.Y + $glowRadius))
    ))
    try {
      $coreGlow.CenterColor = [System.Drawing.Color]::FromArgb(120, 117, 177, 131)
      $coreGlow.SurroundColors = @([System.Drawing.Color]::Transparent)
      $graphics.FillEllipse($coreGlow, $coreCenter.X - $glowRadius, $coreCenter.Y - $glowRadius, $glowRadius * 2, $glowRadius * 2)
    }
    finally {
      $coreGlow.Dispose()
    }

    $orbRadius = [Math]::Max(2.0, $tileSize * 0.085)
    $orbBrush = [System.Drawing.Drawing2D.PathGradientBrush]::new([System.Drawing.PointF[]] @(
      (New-Point ($coreCenter.X - $orbRadius) $coreCenter.Y),
      (New-Point $coreCenter.X ($coreCenter.Y - $orbRadius)),
      (New-Point ($coreCenter.X + $orbRadius) $coreCenter.Y),
      (New-Point $coreCenter.X ($coreCenter.Y + $orbRadius))
    ))
    try {
      $orbBrush.CenterPoint = New-Point ($coreCenter.X - $orbRadius * 0.18) ($coreCenter.Y - $orbRadius * 0.22)
      $orbBrush.CenterColor = [System.Drawing.Color]::FromArgb(228, 241, 251, 245)
      $orbBrush.SurroundColors = @($sage)
      $graphics.FillEllipse($orbBrush, $coreCenter.X - $orbRadius, $coreCenter.Y - $orbRadius, $orbRadius * 2, $orbRadius * 2)
    }
    finally {
      $orbBrush.Dispose()
    }

    $orbEdge = [System.Drawing.Pen]::new($frostEdge, [Math]::Max(1.0, $tileSize * 0.018))
    try {
      $graphics.DrawEllipse($orbEdge, $coreCenter.X - $orbRadius, $coreCenter.Y - $orbRadius, $orbRadius * 2, $orbRadius * 2)
    }
    finally {
      $orbEdge.Dispose()
    }

    $specBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(170, 255, 255, 255))
    try {
      $graphics.FillEllipse($specBrush, $coreCenter.X - $orbRadius * 0.52, $coreCenter.Y - $orbRadius * 0.62, $orbRadius * 0.62, $orbRadius * 0.46)
    }
    finally {
      $specBrush.Dispose()
    }

    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$outputs = @(
  @{ Size = 16; File = 'icon16.png' },
  @{ Size = 32; File = 'icon32.png' },
  @{ Size = 48; File = 'icon48.png' },
  @{ Size = 128; File = 'icon128.png' },
  @{ Size = 1024; File = 'icon1024.png' }
)

foreach ($item in $outputs) {
  Draw-Icon -Size $item.Size -OutputPath (Join-Path $baseDir $item.File)
}
