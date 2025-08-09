import os, time, cv2, numpy as np

name = os.getenv("INSTANCE_NAME", "proc")
url  = os.getenv("STREAM_URL", "rtsp://localhost:8554/fakestream")

# Create output directory for difference frames
output_dir = f"/tmp/{name}_frames"
os.makedirs(output_dir, exist_ok=True)

def open_capture(u):
    for i in range(30):
        cap = cv2.VideoCapture(u)
        if cap.isOpened():
            return cap
        time.sleep(1)
    raise RuntimeError("Unable to open stream after retries")

cap = open_capture(url)
print(f"[{name}] Connected to {url}")

t0 = time.time()
frames = 0
prev_gray = None
change_threshold = 10  # Lowered threshold for more sensitivity (was 30)
while True:
    ok, frame = cap.read()
    if not ok:
        print(f"[{name}] No frame, retrying...")
        time.sleep(0.5)
        cap.release()
        cap = open_capture(url)
        prev_gray = None  # Reset previous frame after reconnection
        continue

    # Convert to grayscale for processing
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # Calculate changed pixels if we have a previous frame
    changed_pixels = 0
    max_diff = 0
    avg_diff = 0
    diff = None
    if prev_gray is not None:
        # Calculate absolute difference between frames
        diff = cv2.absdiff(prev_gray, gray)
        # Count pixels that changed significantly
        changed_pixels = np.sum(diff > change_threshold)
        # Track maximum and average difference for debugging
        max_diff = np.max(diff)
        avg_diff = np.mean(diff)
    
    # Store current frame for next iteration
    prev_gray = gray.copy()
    
    # Optional: still do edge detection for other purposes
    _edges = cv2.Canny(gray, 80, 160)

    frames += 1
    
    # Save difference frame periodically or when significant changes detected
    if diff is not None and (frames % 150 == 0 or changed_pixels > 1000):
        # Create a enhanced visualization of the difference
        diff_enhanced = cv2.applyColorMap(diff, cv2.COLORMAP_HOT)
        timestamp = int(time.time() * 1000)  # millisecond timestamp
        diff_filename = f"{output_dir}/diff_frame_{frames}_{timestamp}.jpg"
        cv2.imwrite(diff_filename, diff_enhanced)
        
        # Also save the thresholded binary mask showing detected changes
        binary_mask = (diff > change_threshold).astype(np.uint8) * 255
        mask_filename = f"{output_dir}/mask_frame_{frames}_{timestamp}.jpg"
        #cv2.imwrite(mask_filename, binary_mask)
        
        print(f"[{name}] Saved difference frame: {diff_filename}")
        print(f"[{name}] Saved binary mask: {mask_filename}")
    
    if frames % 150 == 0:
        dt = time.time() - t0
        fps = frames / dt if dt > 0 else 0
        h, w = frame.shape[:2]
        total_pixels = h * w
        change_percent = (changed_pixels / total_pixels * 100) if total_pixels > 0 else 0
        print(f"[{name}] frames={frames} fps≈{fps:.1f} res={w}x{h} changed_pixels={changed_pixels} ({change_percent:.1f}%) max_diff={max_diff} avg_diff={avg_diff:.1f}")