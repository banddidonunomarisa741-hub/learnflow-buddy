$ErrorActionPreference = 'Stop'
$documentRoot = Split-Path -Parent $PSScriptRoot
$pptxPath = Join-Path $documentRoot 'output/slides/LearnFlow学习流动-答辩演示.pptx'
$pdfPath = Join-Path $documentRoot 'output/pdf/LearnFlow学习流动-答辩演示.pdf'
$powerpoint = New-Object -ComObject PowerPoint.Application
$presentation = $null
try {
    $presentation = $powerpoint.Presentations.Open($pptxPath, $true, $false, $false)
    $presentation.SaveAs($pdfPath, 32)
    Write-Output $pdfPath
} finally {
    if ($null -ne $presentation) { $presentation.Close() }
    if ($powerpoint.Presentations.Count -eq 0) { $powerpoint.Quit() }
    [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($powerpoint) | Out-Null
}
