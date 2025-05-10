# Simple PowerShell HTTP Server
# Run with: powershell -ExecutionPolicy Bypass -File simple-server.ps1

$port = 8080
$path = Join-Path $PSScriptRoot "public"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "==============================================="
Write-Host "  Pomodoro App Server Running"
Write-Host "==============================================="
Write-Host "  Local: http://localhost:$port"
Write-Host "==============================================="
Write-Host "  Press Ctrl+C to stop the server"
Write-Host "==============================================="

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        # Get the requested URL
        $requestUrl = $request.Url.LocalPath
        if ($requestUrl -eq "/") {
            $requestUrl = "/index.html"
        }
        
        # Construct the file path
        $filePath = Join-Path $path $requestUrl.TrimStart("/")
        
        # Check if file exists
        if (Test-Path $filePath -PathType Leaf) {
            # Determine content type based on file extension
            $extension = [System.IO.Path]::GetExtension($filePath)
            $contentType = switch ($extension) {
                ".html" { "text/html" }
                ".css" { "text/css" }
                ".js" { "text/javascript" }
                ".json" { "application/json" }
                ".png" { "image/png" }
                ".jpg" { "image/jpeg" }
                ".gif" { "image/gif" }
                default { "application/octet-stream" }
            }
            
            # Read file content
            $content = [System.IO.File]::ReadAllBytes($filePath)
            
            # Set response headers
            $response.ContentType = $contentType
            $response.ContentLength64 = $content.Length
            $response.StatusCode = 200
            
            # Write content to response
            $output = $response.OutputStream
            $output.Write($content, 0, $content.Length)
            $output.Close()
            
            Write-Host "$([DateTime]::Now) - 200 OK - $requestUrl"
        } else {
            # File not found
            $response.StatusCode = 404
            $response.ContentType = "text/plain"
            $content = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.ContentLength64 = $content.Length
            $response.OutputStream.Write($content, 0, $content.Length)
            $response.OutputStream.Close()
            
            Write-Host "$([DateTime]::Now) - 404 Not Found - $requestUrl"
        }
    }
} finally {
    $listener.Stop()
} 