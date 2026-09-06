param([string]$DraftPath, [switch]$ReadStdin, [ValidateSet('review','delete','import')][string]$Mode='review')
$ErrorActionPreference='Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class LearnFlowDialogWindow { [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr handle, int command); }'
if ($ReadStdin) { $draft = [Console]::In.ReadToEnd() | ConvertFrom-Json }
elseif ($DraftPath) { $draft = Get-Content -LiteralPath $DraftPath -Raw -Encoding UTF8 | ConvertFrom-Json }
else { throw 'Missing review content.' }
$answer = @{ approved = $false }
if ($Mode -eq 'import') {
  $bootstrap = New-Object System.Windows.Forms.Form
  $bootstrap.Opacity = 0
  $bootstrap.ShowInTaskbar = $false
  $bootstrap.Show()
  $bootstrap.Hide()
  $picker = New-Object System.Windows.Forms.OpenFileDialog
  $picker.Title = 'LearnFlow - 选择要保存的 PDF'
  $picker.Filter = 'PDF 教材 (*.pdf)|*.pdf'
  $picker.Multiselect = $false
  if ($picker.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $answer = @{ approved = $true; path = $picker.FileName } }
  $picker.Dispose()
  $bootstrap.Dispose()
} else {
  $form = New-Object System.Windows.Forms.Form
  $form.Text = 'LearnFlow学习流动 · 由你决定是否保存'
  $iconPath = Join-Path $PSScriptRoot 'learnflow.ico'
  if (Test-Path -LiteralPath $iconPath) { $form.Icon = New-Object System.Drawing.Icon($iconPath) }
  $form.Size = New-Object System.Drawing.Size(740,650)
  $form.MinimumSize = New-Object System.Drawing.Size(600,500)
  $form.StartPosition = 'CenterScreen'
  $form.BackColor = [System.Drawing.Color]::FromArgb(252,249,244)
  $form.Font = New-Object System.Drawing.Font('Microsoft YaHei UI',11)
  $form.TopMost = $true
  # The helper console is hidden. Explicitly show only this consent window after creation.
  $form.Add_Shown({ [void][LearnFlowDialogWindow]::ShowWindowAsync($form.Handle,5) })
  $form.Padding = New-Object System.Windows.Forms.Padding(22)
  $title = New-Object System.Windows.Forms.TextBox
  $title.Text = [string]$draft.title
  $title.MaxLength = 100
  $title.Dock = 'Top'
  $title.Font = New-Object System.Drawing.Font('Microsoft YaHei UI',14)
  $body = New-Object System.Windows.Forms.TextBox
  $body.Multiline = $true
  $body.ScrollBars = 'Vertical'
  $body.AcceptsReturn = $true
  $body.Text = ([string]$draft.markdown) -replace "`n","`r`n"
  $body.MaxLength = 60000
  $body.Dock = 'Fill'
  $body.BorderStyle = 'FixedSingle'
  $bottom = New-Object System.Windows.Forms.FlowLayoutPanel
  $bottom.Dock = 'Bottom'
  $bottom.Height = 68
  $bottom.FlowDirection = 'RightToLeft'
  $save = New-Object System.Windows.Forms.Button
  $save.Text = '保存到本机'
  $save.Size = New-Object System.Drawing.Size(150,42)
  $save.BackColor = [System.Drawing.Color]::FromArgb(255,145,56)
  $save.FlatStyle = 'Flat'
  $cancel = New-Object System.Windows.Forms.Button
  $cancel.Text = '这次不保存'
  $cancel.Size = New-Object System.Drawing.Size(150,42)
  $cancel.DialogResult = 'Cancel'
  $note = New-Object System.Windows.Forms.Label
  $note.Dock = 'Top'
  $note.Height = 50
  $note.Text = '内容还没保存。你可以在这里修改，点保存后才会留下。'
  if ($Mode -eq 'delete') {
    $form.Text = 'LearnFlow学习流动 · 删除这份资产'
    $save.Text = '确认删除'
    $cancel.Text = '保留'
    $note.Text = '将删除本机 LearnFlow 里的这份副本。原始教材不会被删除。'
    $title.ReadOnly = $true
    $body.ReadOnly = $true
  }
  $save.Add_Click({
    if ($Mode -eq 'review' -and ([string]::IsNullOrWhiteSpace($title.Text) -or [string]::IsNullOrWhiteSpace($body.Text))) { return }
    $form.Tag = @{ approved = $true; title = $title.Text; markdown = $body.Text -replace "`r`n","`n" }
    $form.DialogResult = 'OK'
    $form.Close()
  })
  $bottom.Controls.Add($save)
  $bottom.Controls.Add($cancel)
  $form.Controls.Add($body)
  $form.Controls.Add($note)
  $form.Controls.Add($title)
  $form.Controls.Add($bottom)
  $form.CancelButton = $cancel
  [void]$form.ShowDialog()
  if ($form.Tag) { $answer = $form.Tag }
  $form.Dispose()
}
$answer | ConvertTo-Json -Compress -Depth 5
