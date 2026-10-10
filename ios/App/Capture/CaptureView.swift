import AtlasCore
import PhotosUI
import SwiftUI
import UIKit

struct CaptureView: View {
    @StateObject private var model: CaptureViewModel
    @State private var photosItem: PhotosPickerItem?
    @State private var showCamera = false

    init(session: SessionStore) {
        _model = StateObject(wrappedValue: CaptureViewModel(session: session))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    SectionHead(kicker: "Capture")
                    Text("Upload a sky photo, keep EXIF context, and optionally identify objects in-frame.")
                        .font(.system(size: 14))
                        .foregroundStyle(Brand.muted)

                    photoSection
                    metadataSection
                    photoIDSection
                    notesSection
                    uploadSection
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 28)
            }
            .background(Brand.bg.ignoresSafeArea())
            .navigationTitle("Capture")
            .sheet(isPresented: $showCamera) {
                CameraImagePicker { image in
                    model.ingestSelectedImage(image, originalData: image.jpegData(compressionQuality: 1))
                }
            }
            .onChange(of: photosItem) { _, newValue in
                guard let newValue else { return }
                Task {
                    guard let data = try? await newValue.loadTransferable(type: Data.self),
                          let image = UIImage(data: data)
                    else { return }
                    await MainActor.run {
                        model.ingestSelectedImage(image, originalData: data)
                    }
                }
            }
            .task { model.onAppear() }
        }
    }

    private var photoSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Photo")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Brand.ink)

            if let image = model.selectedImage {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(height: 220)
                    .frame(maxWidth: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Brand.line))
                    .accessibilityLabel("Selected sky photo preview")
            } else {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Brand.surface)
                    .frame(height: 140)
                    .overlay(Text("No photo selected").font(.system(size: 14)).foregroundStyle(Brand.muted))
                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Brand.line))
            }

            HStack(spacing: 12) {
                PhotosPicker(selection: $photosItem, matching: .images, photoLibrary: .shared()) {
                    Label("Choose from library", systemImage: "photo.on.rectangle")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity, minHeight: 46)
                }
                .buttonStyle(.borderedProminent)
                .tint(Brand.violet)
                .accessibilityLabel("Choose sky photo from library")

                Button {
                    showCamera = true
                } label: {
                    Label("Open camera", systemImage: "camera")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity, minHeight: 46)
                }
                .buttonStyle(.bordered)
                .disabled(!UIImagePickerController.isSourceTypeAvailable(.camera))
                .accessibilityLabel("Open camera to take a sky photo")
            }

            if model.selectedImage != nil {
                Button("Remove photo") {
                    model.clearSelection()
                }
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Brand.flagship)
                .frame(minHeight: 44)
                .accessibilityLabel("Remove selected photo")
            }
        }
        .padding(14)
        .brandCard()
    }

    @ViewBuilder
    private var metadataSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Photo metadata")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Brand.ink)

            if let exif = model.exif {
                VStack(alignment: .leading, spacing: 6) {
                    metadataLine("Captured at", exif.dateTaken?.formatted(date: .abbreviated, time: .shortened) ?? "Unknown")
                    metadataLine("Camera", exif.cameraLabel ?? "Unknown")
                    metadataLine("Coordinates", exif.latitude != nil && exif.longitude != nil
                        ? "\(String(format: "%.5f", exif.latitude!)), \(String(format: "%.5f", exif.longitude!))"
                        : "Not present")
                    metadataLine("Heading", exif.headingDeg.map { "\(Int($0.rounded()))°" } ?? "Not present")
                    if !exif.timeZoneKnown {
                        Text("Timezone was not explicitly stored in EXIF. Confirm date/time before identifying.")
                            .font(.system(size: 14))
                            .foregroundStyle(Brand.amber)
                    }
                }
            } else {
                Text("Select a photo to inspect EXIF time, location, heading, and camera fields.")
                    .font(.system(size: 14))
                    .foregroundStyle(Brand.muted)
            }

            DatePicker("Capture time", selection: $model.manualDate, displayedComponents: [.date, .hourAndMinute])
                .font(.system(size: 14))
                .accessibilityLabel("Capture time")

            HStack(spacing: 10) {
                TextField("Latitude", text: $model.manualLatitude)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(.roundedBorder)
                    .font(.system(size: 14))
                    .accessibilityLabel("Latitude")
                TextField("Longitude", text: $model.manualLongitude)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(.roundedBorder)
                    .font(.system(size: 14))
                    .accessibilityLabel("Longitude")
            }
        }
        .padding(14)
        .brandCard()
    }

    private var photoIDSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Photo ID")
                .font(.system(size: 15, weight: .semibold))

            Button {
                model.identifyPhotoSky()
            } label: {
                Text("Identify sky objects")
                    .font(.system(size: 14, weight: .semibold))
                    .frame(maxWidth: .infinity, minHeight: 46)
            }
            .buttonStyle(.borderedProminent)
            .tint(Brand.violet)
            .accessibilityLabel("Identify sky objects in this photo")

            Toggle("Attach result summary to upload", isOn: $model.attachPhotoIDResult)
                .font(.system(size: 14))
                .toggleStyle(.switch)
                .accessibilityLabel("Attach photo identification summary to upload")

            if let result = model.photoIDResult {
                Text(result.summary)
                    .font(.system(size: 14))
                    .foregroundStyle(Brand.ink)
                    .padding(.bottom, 2)
                if !result.objects.isEmpty {
                    ForEach(result.objects.prefix(4), id: \.target) { object in
                        HStack {
                            Text(object.name).font(.system(size: 14, weight: .medium))
                            Spacer()
                            Text("\(Int(object.altitudeDeg.rounded()))° \(object.compassLabel)")
                                .font(.system(size: 14))
                                .foregroundStyle(Brand.muted)
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
            }
        }
        .padding(14)
        .brandCard()
    }

    private var notesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Observation details")
                .font(.system(size: 15, weight: .semibold))
            TextField("Target (optional, e.g. Saturn)", text: $model.targetName)
                .textFieldStyle(.roundedBorder)
                .font(.system(size: 14))
                .accessibilityLabel("Target name")
            TextField("Session note", text: $model.note, axis: .vertical)
                .lineLimit(3...6)
                .textFieldStyle(.roundedBorder)
                .font(.system(size: 14))
                .accessibilityLabel("Session note")
        }
        .padding(14)
        .brandCard()
    }

    private var uploadSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Upload")
                .font(.system(size: 15, weight: .semibold))

            if !model.uploadStatusLabel.isEmpty {
                Text(model.uploadStatusLabel)
                    .font(.system(size: 14))
                    .foregroundStyle(model.uploadError == nil ? Brand.muted : Brand.flagship)
            }

            if let error = model.uploadError {
                Text(error)
                    .font(.system(size: 14))
                    .foregroundStyle(Brand.flagship)
                    .accessibilityLabel("Upload error: \(error)")
            }

            Button {
                Task { await model.submitCapture() }
            } label: {
                if model.isBusy {
                    ProgressView().frame(maxWidth: .infinity, minHeight: 46)
                } else {
                    Text("Upload photo")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity, minHeight: 46)
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(Brand.flagship)
            .disabled(model.isBusy || model.selectedImage == nil)
            .accessibilityLabel("Upload photo")

            if model.queuedCount > 0 {
                Button {
                    Task { await model.retryPendingUploads() }
                } label: {
                    Text("Retry pending uploads (\(model.queuedCount))")
                        .font(.system(size: 14, weight: .medium))
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.bordered)
                .accessibilityLabel("Retry pending uploads")
            }
        }
        .padding(14)
        .brandCard(accent: Brand.flagship.opacity(0.45))
    }

    private func metadataLine(_ label: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label)
                .font(.system(size: 14, weight: .medium))
            Spacer()
            Text(value)
                .font(.system(size: 14))
                .foregroundStyle(Brand.muted)
                .multilineTextAlignment(.trailing)
        }
    }
}
