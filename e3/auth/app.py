from flask import Flask, request, abort
app = Flask(__name__)

@app.get("/validate")
def validate():
    name = request.args.get("name")
    token = request.args.get("token")
    args = request.args.get("args")
    if not token and args:
        for pair in args.split("&"):
            k, _, v = pair.partition("=")
            if k == "token":
                token = v
                break
    if name != "mystream": abort(403)
    if token != "supersecret": abort(403)
    return "ok", 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8081)