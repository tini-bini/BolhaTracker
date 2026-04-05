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

  $brandInkTop = [System.Drawing.Color]::FromArgb(255, 60, 73, 81)
  $brandInkBottom = [System.Drawing.Color]::FromArgb(255, 45, 57, 64)
  $brandCyan = [System.Drawing.Color]::FromArgb(255, 22, 167, 220)
  $brandGreen = [System.Drawing.Color]::FromArgb(255, 143, 198, 66)
  $brandYellow = [System.Drawing.Color]::FromArgb(255, 246, 197, 47)
  $brandPink = [System.Drawing.Color]::FromArgb(255, 239, 10, 135)
  $lineColor = [System.Drawing.Color]::FromArgb(255, 248, 251, 252)
  $borderColor = [System.Drawing.Color]::FromArgb(30, 255, 255, 255)
  $shadowColor = [System.Drawing.Color]::FromArgb(56, 28, 36, 42)

  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $pad = [Math]::Max(1.0, $Size * 0.09)
    $tileSize = $Size - ($pad * 2)
    $radius = $tileSize * 0.28
    $stripeHeight = [Math]::Max(1.5, $tileSize * 0.075)

    $shadowBrush = [System.Drawing.SolidBrush]::new($shadowColor)
    try {
      Fill-RoundedRect -Graphics $graphics -Brush $shadowBrush -X ($pad + ($Size * 0.006)) -Y ($pad + ($Size * 0.024)) -Width $tileSize -Height $tileSize -Radius $radius
    }
    finally {
      $shadowBrush.Dispose()
    }

    $tileBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
      (New-Point ($pad + $tileSize * 0.5) $pad),
      (New-Point ($pad + $tileSize * 0.5) ($pad + $tileSize)),
      $brandInkTop,
      $brandInkBottom
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

      $segmentWidth = $tileSize / 4
      $segmentSpecs = @(
        @{ X = $pad; Color = $brandCyan },
        @{ X = $pad + $segmentWidth; Color = $brandGreen },
        @{ X = $pad + ($segmentWidth * 2); Color = $brandYellow },
        @{ X = $pad + ($segmentWidth * 3); Color = $brandPink }
      )

      foreach ($segment in $segmentSpecs) {
        $segmentBrush = [System.Drawing.SolidBrush]::new($segment.Color)
        try {
          $graphics.FillRectangle($segmentBrush, $segment.X, $pad, $segmentWidth + 1, $stripeHeight)
        }
        finally {
          $segmentBrush.Dispose()
        }
      }

      $graphics.ResetClip()
    }
    finally {
      $clipPath.Dispose()
    }

    $borderPen = [System.Drawing.Pen]::new($borderColor, [Math]::Max(1.0, $tileSize * 0.012))
    try {
      Draw-RoundedRect -Graphics $graphics -Pen $borderPen -X ($pad + 0.5) -Y ($pad + 0.5) -Width ($tileSize - 1) -Height ($tileSize - 1) -Radius ($radius * 0.98)
    }
    finally {
      $borderPen.Dispose()
    }

    $linePoints = [System.Drawing.PointF[]] @(
      (New-Point ($pad + $tileSize * 0.27) ($pad + $tileSize * 0.68)),
      (New-Point ($pad + $tileSize * 0.43) ($pad + $tileSize * 0.56)),
      (New-Point ($pad + $tileSize * 0.57) ($pad + $tileSize * 0.45)),
      (New-Point ($pad + $tileSize * 0.71) ($pad + $tileSize * 0.33))
    )

    $lineShadowPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $linePath = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $lineShadowPath.AddLines([System.Drawing.PointF[]] @(
      (New-Point ($linePoints[0].X + $Size * 0.008) ($linePoints[0].Y + $Size * 0.012)),
      (New-Point ($linePoints[1].X + $Size * 0.008) ($linePoints[1].Y + $Size * 0.012)),
      (New-Point ($linePoints[2].X + $Size * 0.008) ($linePoints[2].Y + $Size * 0.012)),
      (New-Point ($linePoints[3].X + $Size * 0.008) ($linePoints[3].Y + $Size * 0.012))
    ))
    $linePath.AddLines($linePoints)

    try {
      $lineShadowPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(42, 0, 0, 0), [Math]::Max(1.6, $tileSize * 0.12))
      $lineShadowPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
      $lineShadowPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
      $lineShadowPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
      try {
        $graphics.DrawPath($lineShadowPen, $lineShadowPath)
      }
      finally {
        $lineShadowPen.Dispose()
      }

      $linePen = [System.Drawing.Pen]::new($lineColor, [Math]::Max(1.4, $tileSize * 0.11))
      $linePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
      $linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
      $linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
      try {
        $graphics.DrawPath($linePen, $linePath)
      }
      finally {
        $linePen.Dispose()
      }
    }
    finally {
      $lineShadowPath.Dispose()
      $linePath.Dispose()
    }

    $endPoint = $linePoints[3]
    $dotRadius = [Math]::Max(1.8, $tileSize * 0.09)
    $dotBrush = [System.Drawing.SolidBrush]::new($brandGreen)
    $dotPen = [System.Drawing.Pen]::new($lineColor, [Math]::Max(1.0, $tileSize * 0.018))
    try {
      $graphics.FillEllipse($dotBrush, $endPoint.X - $dotRadius, $endPoint.Y - $dotRadius, $dotRadius * 2, $dotRadius * 2)
      $graphics.DrawEllipse($dotPen, $endPoint.X - $dotRadius, $endPoint.Y - $dotRadius, $dotRadius * 2, $dotRadius * 2)
    }
    finally {
      $dotBrush.Dispose()
      $dotPen.Dispose()
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
  @{ Size = 16; File = "icon16.png" },
  @{ Size = 32; File = "icon32.png" },
  @{ Size = 48; File = "icon48.png" },
  @{ Size = 128; File = "icon128.png" },
  @{ Size = 1024; File = "icon1024.png" }
)

foreach ($item in $outputs) {
  Draw-Icon -Size $item.Size -OutputPath (Join-Path $baseDir $item.File)
}
