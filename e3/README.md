docker compose build processor
docker compose up --scale processor=2

# then in VLC:
#   RTMP: rtmp://localhost/live/mystream
# or HLS:
#   http://localhost:8080/hls/mystream.m3u8