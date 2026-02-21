import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CloudinaryService, CloudinaryUploadResponse } from '../../services/cloudinary.service';
import { MaterialImage } from '../../models/material.model';

@Component({
  selector: 'app-image-manager',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-manager.component.html',
  styleUrls: ['./image-manager.component.css']
})
export class ImageManagerComponent implements OnInit {
  @Input() images: MaterialImage[] = [];
  @Input() maxImages = 5;
  @Input() allowMultiple = true;
  @Input() folder = 'materials'; // Carpeta por defecto
  @Output() imagesChange = new EventEmitter<MaterialImage[]>();
  @Output() imageAdded = new EventEmitter<MaterialImage>();
  @Output() imageRemoved = new EventEmitter<MaterialImage>();

  uploading = false;
  dragOver = false;
  uploadProgress: { [key: string]: number } = {};

  constructor(private cloudinaryService: CloudinaryService) {}

  ngOnInit(): void {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.handleFiles(Array.from(input.files));
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    
    if (event.dataTransfer?.files) {
      this.handleFiles(Array.from(event.dataTransfer.files));
    }
  }

  handleFiles(files: File[]): void {
    if (!this.allowMultiple && files.length > 1) {
      files = [files[0]];
    }

    const remainingSlots = this.maxImages - this.images.length;
    if (files.length > remainingSlots) {
      files = files.slice(0, remainingSlots);
    }

    files.forEach(file => {
      const validation = this.cloudinaryService.validateImageFile(file);
      if (!validation.valid) {
        console.error('File validation failed:', validation.error);
        return;
      }

      this.processFileLocally(file);
    });
  }

  processFileLocally(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const newImage: MaterialImage = {
        id: Date.now(),
        materialId: 0,
        url: e.target?.result as string, // Base64 URL temporal
        status: 'active',
        file: file // Guardar el archivo para enviarlo después
      };

      this.images.push(newImage);
      this.imagesChange.emit(this.images);
      this.imageAdded.emit(newImage);
    };
    reader.readAsDataURL(file);
  }

  uploadFile(file: File): void {
    this.uploading = true;
    const fileId = `${Date.now()}_${file.name}`;
    this.uploadProgress[fileId] = 0;

    // Simulate progress
    const progressInterval = setInterval(() => {
      if (this.uploadProgress[fileId] < 90) {
        this.uploadProgress[fileId] += Math.random() * 20;
      }
    }, 200);

    this.cloudinaryService.uploadImage(file, this.folder).subscribe({
      next: (response: CloudinaryUploadResponse) => {
        clearInterval(progressInterval);
        this.uploadProgress[fileId] = 100;

        const newImage: MaterialImage = {
          id: Date.now(),
          materialId: 0, // Will be set when material is saved
          url: response.secure_url,
          status: 'active'
        };

        this.images.push(newImage);
        this.imagesChange.emit(this.images);
        this.imageAdded.emit(newImage);
        
        setTimeout(() => {
          delete this.uploadProgress[fileId];
          this.uploading = Object.keys(this.uploadProgress).length > 0;
        }, 1000);
      },
      error: (error) => {
        clearInterval(progressInterval);
        delete this.uploadProgress[fileId];
        this.uploading = Object.keys(this.uploadProgress).length > 0;
        console.error('Upload failed:', error);
      }
    });
  }

  removeImage(image: MaterialImage): void {
    const index = this.images.findIndex(img => img.id === image.id);
    if (index > -1) {
      this.images.splice(index, 1);
      this.imagesChange.emit(this.images);
      this.imageRemoved.emit(image);
    }
  }

  getProgressEntries(): Array<{key: string, value: number}> {
    return Object.entries(this.uploadProgress).map(([key, value]) => ({key, value}));
  }

  canAddMore(): boolean {
    return this.images.length < this.maxImages;
  }

  selectedImage: MaterialImage | null = null;

  viewImage(image: MaterialImage): void {
    this.selectedImage = image;
  }

  closeImageViewer(): void {
    this.selectedImage = null;
  }

  trackByImageId(index: number, image: MaterialImage): number {
    return image.id;
  }
}