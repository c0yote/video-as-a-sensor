import os, time, cv2, numpy as np

name = os.getenv("INSTANCE_NAME", "proc2")
#url  = os.getenv("STREAM_URL", "rtmp://relay:1935/live/mystream")
url  = "rtsp://localhost:8554/fakestream"

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

def calculate_roi_box(frame_height, frame_width):
    """Calculate ROI box coordinates for center of right half of screen"""
    # Right half starts at width/2
    right_half_start = frame_width // 2
    right_half_width = frame_width - right_half_start
    
    # Center box in the right half (25% of right half width and height)
    box_width = max(right_half_width // 4, 50)  # At least 50px wide
    box_height = max(frame_height // 4, 50)     # At least 50px tall
    
    # Center the box in the right half
    x1 = right_half_start + (right_half_width - box_width) // 2
    y1 = (frame_height - box_height) // 2
    x2 = x1 + box_width
    y2 = y1 + box_height
    
    return x1, y1, x2, y2

cap = open_capture(url)
print(f"[{name}] Connected to {url}")

t0 = time.time()
frames = 0
prev_gray_roi = None
change_threshold = 10  # Lowered threshold for more sensitivity (was 30)
roi_box = None  # Will be calculated from first frame

while True:
    ok, frame = cap.read()
    if not ok:
        print(f"[{name}] No frame, retrying...")
        time.sleep(0.5)
        cap.release()
        cap = open_capture(url)
        prev_gray_roi = None  # Reset previous frame after reconnection
        roi_box = None  # Recalculate ROI after reconnection
        continue

    # Convert to grayscale for processing
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape[:2]
    
    # Calculate ROI box on first frame or after reconnection
    if roi_box is None:
        roi_box = calculate_roi_box(h, w)
        x1, y1, x2, y2 = roi_box
        print(f"[{name}] ROI box set to: ({x1},{y1}) to ({x2},{y2}) - size: {x2-x1}x{y2-y1}")
    
    # Extract ROI from current frame
    x1, y1, x2, y2 = roi_box
    gray_roi = gray[y1:y2, x1:x2]
    
    # Calculate changed pixels if we have a previous ROI frame
    changed_pixels = 0
    max_diff = 0
    avg_diff = 0
    diff_roi = None
    
    if prev_gray_roi is not None:
        # Calculate absolute difference between ROI frames
        diff_roi = cv2.absdiff(prev_gray_roi, gray_roi)
        # Count pixels that changed significantly in ROI
        changed_pixels = np.sum(diff_roi > change_threshold)
        # Track maximum and average difference for debugging
        max_diff = np.max(diff_roi)
        avg_diff = np.mean(diff_roi)
    
    # Store current ROI frame for next iteration
    prev_gray_roi = gray_roi.copy()
    
    frames += 1
    
    # Save difference frame periodically or when significant changes detected
    if diff_roi is not None and (frames % 150 == 0 or changed_pixels > 100):
        # Create full-frame visualization with ROI highlighted
        full_diff = np.zeros_like(gray)
        full_diff[y1:y2, x1:x2] = diff_roi
        
        # Create enhanced visualization of the difference
        diff_enhanced = cv2.applyColorMap(full_diff, cv2.COLORMAP_HOT)
        
        # Draw ROI box on the enhanced image
        cv2.rectangle(diff_enhanced, (x1, y1), (x2, y2), (0, 255, 255), 2)  # Yellow box
        
        timestamp = int(time.time() * 1000)  # millisecond timestamp
        diff_filename = f"{output_dir}/roi_diff_frame_{frames}_{timestamp}.jpg"
        cv2.imwrite(diff_filename, diff_enhanced)
        
        # Also save the thresholded binary mask showing detected changes in ROI
        full_mask = np.zeros_like(gray)
        binary_mask_roi = (diff_roi > change_threshold).astype(np.uint8) * 255
        full_mask[y1:y2, x1:x2] = binary_mask_roi
        
        # Add ROI box to mask as well
        full_mask_colored = cv2.cvtColor(full_mask, cv2.COLOR_GRAY2BGR)
        cv2.rectangle(full_mask_colored, (x1, y1), (x2, y2), (0, 255, 255), 2)  # Yellow box
        
        mask_filename = f"{output_dir}/roi_mask_frame_{frames}_{timestamp}.jpg"
        cv2.imwrite(mask_filename, full_mask_colored)
        
        print(f"[{name}] Saved ROI difference frame: {diff_filename}")
        print(f"[{name}] Saved ROI binary mask: {mask_filename}")
    
    if frames % 150 == 0:
        dt = time.time() - t0
        fps = frames / dt if dt > 0 else 0
        roi_pixels = (x2-x1) * (y2-y1)
        change_percent = (changed_pixels / roi_pixels * 100) if roi_pixels > 0 else 0
        print(f"[{name}] frames={frames} fps≈{fps:.1f} res={w}x{h} ROI=({x1},{y1})-({x2},{y2}) changed_pixels={changed_pixels}/{roi_pixels} ({change_percent:.1f}%) max_diff={max_diff} avg_diff={avg_diff:.1f}")
