#!/usr/bin/env python3
"""
Simple HTTP Server for Pomodoro App
For users who don't have Node.js installed
"""

import http.server
import socketserver
import os
import socket

# Configuration
PORT = 8080
DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def log_message(self, format, *args):
        print(f"{self.address_string()} - {args[0]} {args[1]} {args[2]}")

def get_local_ip():
    """Get the local IP address"""
    try:
        # Create a socket connection to an external server
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))  # Google's DNS server
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

def main():
    """Start the HTTP server"""
    os.chdir(DIRECTORY)
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        local_ip = get_local_ip()
        
        print("\n===============================================")
        print("  Pomodoro App Server Running")
        print("===============================================")
        print(f"  Local:    http://localhost:{PORT}")
        print(f"  Network:  http://{local_ip}:{PORT}")
        print("===============================================")
        print("  Press Ctrl+C to stop the server")
        print("===============================================\n")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == "__main__":
    main() 