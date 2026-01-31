import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, ImagePlus, Upload, Loader2, X, ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { processReceipt } from "@/services/api";
import type { ItemCreate } from "@/types";

interface ImageFile {
  id: string;
  file: File;
  preview: string;
}

export function ScanReceipt() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<ImageFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingIndex, setProcessingIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFilesSelected = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newImages: ImageFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith("image/") || file.name.toLowerCase().endsWith(".heic")) {
        newImages.push({
          id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
          file,
          preview: URL.createObjectURL(file),
        });
      }
    }

    setImages((prev) => [...prev, ...newImages]);
    setError(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    handleFilesSelected(e.dataTransfer.files);
  }, [handleFilesSelected]);

  const handleRemoveImage = (id: string) => {
    setImages((prev) => {
      const image = prev.find((img) => img.id === id);
      if (image) {
        URL.revokeObjectURL(image.preview);
      }
      return prev.filter((img) => img.id !== id);
    });
  };

  const handleProcess = async () => {
    if (images.length === 0) return;

    setIsProcessing(true);
    setError(null);

    const allItems: ItemCreate[] = [];
    let detectedCurrency: string | null = null;

    try {
      for (let i = 0; i < images.length; i++) {
        setProcessingIndex(i + 1);
        const result = await processReceipt(images[i].file);
        allItems.push(...result.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })));
        // Use the first detected currency
        if (!detectedCurrency && result.currency) {
          detectedCurrency = result.currency;
        }
      }

      images.forEach((img) => URL.revokeObjectURL(img.preview));

      navigate("/create", {
        state: { items: allItems, currency: detectedCurrency },
        replace: true
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process receipt");
      setIsProcessing(false);
    }
  };

  // Prevent accidental navigation during processing
  useEffect(() => {
    if (!isProcessing) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isProcessing]);

  const progressPercent = images.length > 0 ? (processingIndex / images.length) * 100 : 0;
  const isMobile = typeof window !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-2">Scan Receipt</h1>
        <p className="text-muted-foreground mb-6">
          {isMobile
            ? "Take photos or select images of your receipt. "
            : "Drop images of your receipt or click to browse. "}
          All items from all images will be combined. Avoid uploading the same section twice, or items will be duplicated.
        </p>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="hidden"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />

        {/* Drag and drop area - Desktop only */}
        {!isMobile && images.length === 0 && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`mb-6 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
            }`}
          >
            <Upload className={`h-12 w-12 mx-auto mb-4 ${isDragOver ? "text-primary" : "text-muted-foreground"}`} />
            <p className="font-medium mb-1">
              {isDragOver ? "Drop images here" : "Drag & drop receipt images"}
            </p>
            <p className="text-sm text-muted-foreground">
              or click to browse files
            </p>
          </div>
        )}

        {/* Image previews */}
        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            {images.map((image, index) => (
              <Card key={image.id} className="relative overflow-hidden">
                <CardContent className="p-0">
                  <img
                    src={image.preview}
                    alt={`Receipt ${index + 1}`}
                    className="w-full h-32 object-cover"
                  />
                  {!isProcessing && (
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(image.id)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center text-sm cursor-pointer hover:bg-black/80 transition-colors"
                      aria-label="Remove image"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {isProcessing && processingIndex === index + 1 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 text-white animate-spin" />
                    </div>
                  )}
                  {isProcessing && processingIndex > index + 1 && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                        <svg className="h-5 w-5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Progress bar when processing */}
        {isProcessing && (
          <div className="mb-6 space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <p className="text-sm">Please don't close or leave this page while processing.</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Processing receipts...</span>
                <span className="font-medium">{processingIndex} of {images.length}</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          </div>
        )}

        {/* Upload buttons */}
        {!isProcessing && (
          <div className="space-y-3 mb-6">
            {/* Camera button - Mobile only */}
            {isMobile && (
              <Button
                size="lg"
                className="w-full h-14 text-base"
                variant="outline"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="h-5 w-5 mr-2" />
                Take Photo
              </Button>
            )}

            {/* Choose from library button */}
            <Button
              size="lg"
              className="w-full h-14 text-base"
              variant={images.length > 0 ? "outline" : isMobile ? "outline" : "default"}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="h-5 w-5 mr-2" />
              {images.length > 0 ? "Add More Images" : isMobile ? "Choose from Library" : "Browse Images"}
            </Button>
          </div>
        )}

        {error && (
          <p className="text-destructive mb-4 text-sm text-center">{error}</p>
        )}

        {/* Action buttons */}
        <div className="space-y-3">
          <Button
            size="lg"
            className="w-full h-14 text-base"
            onClick={handleProcess}
            disabled={images.length === 0 || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Processing {processingIndex} of {images.length}...
              </>
            ) : (
              <>
                <Upload className="h-5 w-5 mr-2" />
                Process {images.length === 0 ? "" : images.length} {images.length === 1 ? "Image" : "Images"}
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            className="w-full"
            onClick={() => navigate("/create")}
            disabled={isProcessing}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </div>
    </div>
  );
}
