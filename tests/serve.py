# เซิร์ฟเวอร์ทดสอบในเครื่อง: ปิดแคช เพื่อให้แก้ไฟล์แล้วรีเฟรชเห็นผลทันที
# ใช้: python tests/serve.py  แล้วเปิด http://127.0.0.1:8765/
# PUT /assets/(mascot|assembly)/<ชื่อ>.v1.webp = บันทึกไฟล์ (ใช้โดย tests/cut-mascot.html และ tests/asm-bg.html, รับเฉพาะเครื่องนี้)
import http.server, functools, os, re
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def do_PUT(self):
        m = re.fullmatch(r'/assets/(mascot|assembly)/([a-z0-9-]+\.v\d+\.webp)', self.path)
        if not m or self.client_address[0] != '127.0.0.1':
            self.send_error(403); return
        n = int(self.headers.get('Content-Length', 0))
        with open(os.path.join(root, 'assets', m.group(1), m.group(2)), 'wb') as f: f.write(self.rfile.read(n))
        self.send_response(201); self.end_headers()
http.server.ThreadingHTTPServer(('127.0.0.1', 8765), functools.partial(NoCache, directory=root)).serve_forever()
