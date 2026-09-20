import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { useDropzone } from "react-dropzone";
import { Loader2, RotateCcw, Upload, X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string) => void;
  className?: string;
  disabled?: boolean;
  cropEnabled?: boolean;
}

export interface ImageUploadHandle {
  applyCrop: () => Promise<string | null>;
}

interface OptimizeImageResponse {
  url?: string;
  error?: string;
}

const CROP_ASPECT = 16 / 10;

async function optimizeImage(body: FormData | { imageUrl: string }) {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Upload timed out after 20 seconds")), 20000),
  );
  const response = await Promise.race([
    supabase.functions.invoke<OptimizeImageResponse>("optimize-image", { body }),
    timeoutPromise,
  ]);

  if (response.error) throw response.error;
  if (response.data?.error) throw new Error(response.data.error);
  if (!response.data?.url) throw new Error("No image URL was returned");
  return response.data.url;
}

async function createCroppedFile(imageUrl: string, crop: Area) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image();
    nextImage.crossOrigin = "anonymous";
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error("The image could not be prepared for cropping"));
    nextImage.src = imageUrl;
  });

  const outputWidth = Math.min(1200, Math.max(1, Math.round(crop.width)));
  const outputHeight = Math.round(outputWidth / CROP_ASPECT);
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image cropping is not supported by this browser");

  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error("The cropped image could not be created")),
      "image/jpeg",
      0.9,
    );
  });

  return new File([blob], `event-crop-${Date.now()}.jpg`, { type: "image/jpeg" });
}

export const ImageUpload = forwardRef<ImageUploadHandle, ImageUploadProps>(function ImageUpload(
  { value, onChange, className, disabled, cropEnabled = false },
  ref,
) {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [urlInput, setUrlInput] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [cropPending, setCropPending] = useState(false);

  useEffect(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropPending(false);
  }, [value]);

  const uploadFile = useCallback(async (file: File, successMessage: string) => {
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const url = await optimizeImage(formData);
      onChange(url);
      toast.success(successMessage);
      return url;
    } catch (error) {
      console.error("Upload failed:", error);
      const message = error instanceof Error && error.message === "Upload timed out after 20 seconds"
        ? "The upload is taking too long. Please try a smaller image or paste a URL instead."
        : "Failed to upload image. Please try again.";
      toast.error(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [onChange]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    try {
      await uploadFile(file, cropEnabled ? "Image ready to frame" : "Image uploaded and optimized");
    } catch {
      // The upload helper already shows the actionable error.
    }
  }, [cropEnabled, uploadFile]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [],
      "image/png": [],
      "image/webp": [],
    },
    maxFiles: 1,
    noClick: cropEnabled && !!value,
    disabled: disabled || loading || mode === "url",
  });

  const resetCrop = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropPending(false);
  }, []);

  const applyCrop = useCallback(async () => {
    if (!cropEnabled || !cropPending || !value || !croppedAreaPixels) return value || null;
    setLoading(true);
    try {
      const croppedFile = await createCroppedFile(value, croppedAreaPixels);
      const formData = new FormData();
      formData.append("file", croppedFile);
      const croppedUrl = await optimizeImage(formData);
      onChange(croppedUrl);
      toast.success("Image framing applied");
      return croppedUrl;
    } catch (error) {
      console.error("Crop failed:", error);
      toast.error("Failed to apply image framing. Please try again.");
      throw error;
    } finally {
      setLoading(false);
    }
  }, [cropEnabled, cropPending, croppedAreaPixels, onChange, value]);

  useImperativeHandle(ref, () => ({ applyCrop }), [applyCrop]);

  const removeImage = (event: React.MouseEvent) => {
    event.stopPropagation();
    onChange("");
    setUrlInput("");
  };

  const handleUrlSubmit = async () => {
    const imageUrl = urlInput.trim();
    if (!imageUrl) return;

    if (!cropEnabled) {
      onChange(imageUrl);
      toast.success("Image URL set");
      return;
    }

    setLoading(true);
    try {
      const storedUrl = await optimizeImage({ imageUrl });
      onChange(storedUrl);
      toast.success("Image ready to frame");
    } catch (error) {
      console.error("URL image failed:", error);
      toast.error("That URL could not be loaded as an image. Try a direct JPG, PNG, or WebP link.");
    } finally {
      setLoading(false);
    }
  };

  const modeControl = (
    <div className="flex w-fit rounded-lg bg-muted p-1">
      <Button
        type="button"
        variant={mode === "upload" ? "secondary" : "ghost"}
        size="sm"
        onClick={() => setMode("upload")}
        className="h-8 text-xs"
      >
        Upload File
      </Button>
      <Button
        type="button"
        variant={mode === "url" ? "secondary" : "ghost"}
        size="sm"
        onClick={() => setMode("url")}
        className="h-8 text-xs"
      >
        Paste URL
      </Button>
    </div>
  );

  if (cropEnabled) {
    return (
      <div className={cn("space-y-3", className)}>
        {modeControl}

        {mode === "url" && (
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="https://example.com/image.jpg"
              value={urlInput}
              onChange={(event) => setUrlInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleUrlSubmit();
                }
              }}
              disabled={disabled || loading}
            />
            <Button type="button" onClick={() => void handleUrlSubmit()} disabled={!urlInput.trim() || disabled || loading}>
              Set
            </Button>
          </div>
        )}

        {value ? (
          <>
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border bg-muted">
              <Cropper
                image={value}
                crop={crop}
                zoom={zoom}
                aspect={CROP_ASPECT}
                minZoom={1}
                maxZoom={3}
                zoomSpeed={0.15}
                showGrid
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
                onInteractionEnd={() => setCropPending(true)}
                objectFit="cover"
              />
              {loading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <Slider
                aria-label="Image zoom"
                min={1}
                max={3}
                step={0.01}
                value={[zoom]}
                onValueChange={([nextZoom]) => {
                  setZoom(nextZoom);
                  setCropPending(true);
                }}
                disabled={disabled || loading}
              />
              <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {mode === "upload" && (
                <Button type="button" variant="outline" size="sm" onClick={open} disabled={disabled || loading}>
                  <Upload className="mr-2 h-4 w-4" />
                  Replace
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={resetCrop} disabled={disabled || loading}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
              <Button type="button" size="sm" onClick={() => void applyCrop()} disabled={!cropPending || disabled || loading}>
                Apply Crop
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={removeImage} disabled={disabled || loading} aria-label="Remove image">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <input {...getInputProps()} />
          </>
        ) : mode === "upload" ? (
          <div
            {...getRootProps()}
            className={cn(
              "relative flex aspect-[16/10] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-muted/50 transition-colors hover:bg-muted/80",
              isDragActive && "border-primary bg-primary/10",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <input {...getInputProps()} />
            {loading ? <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" /> : <Upload className="h-8 w-8 text-muted-foreground" />}
            <p className="mt-3 text-sm font-medium">{loading ? "Optimizing…" : "Click to upload or drag and drop"}</p>
            <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, or WebP</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {modeControl}
      {mode === "upload" ? (
        <div
          {...getRootProps()}
          className={cn(
            "relative flex aspect-video w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-muted/50 transition-colors hover:bg-muted/80",
            isDragActive && "border-primary bg-primary/10",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <input {...getInputProps()} />
          {value ? (
            <>
              <img src={value} alt="Uploaded" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center bg-foreground/40 opacity-0 transition-opacity hover:opacity-100">
                <p className="font-medium text-background">Click or drop to replace</p>
                <Button type="button" variant="destructive" size="icon" onClick={removeImage} className="absolute right-2 top-2 h-8 w-8" aria-label="Remove image">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {loading && <div className="absolute inset-0 flex items-center justify-center bg-background/80"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
              {loading ? <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" /> : <Upload className="h-8 w-8 text-muted-foreground" />}
              <p className="text-sm font-medium">{loading ? "Optimizing…" : "Click to upload or drag and drop"}</p>
              <p className="text-xs text-muted-foreground">JPG, PNG, or WebP</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="https://example.com/image.jpg" value={urlInput} onChange={(event) => setUrlInput(event.target.value)} disabled={disabled} />
            <Button type="button" onClick={() => void handleUrlSubmit()} disabled={!urlInput || disabled}>Set</Button>
          </div>
          {value && (
            <div className="relative aspect-video overflow-hidden rounded-xl border bg-muted">
              <img src={value} alt="URL preview" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              <Button type="button" variant="destructive" size="icon" onClick={removeImage} className="absolute right-2 top-2 h-8 w-8" aria-label="Remove image">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Enter a direct link to an image (JPG, PNG, WebP).</p>
        </div>
      )}
    </div>
  );
});