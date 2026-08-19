export type AttachmentType = "map" | "photograph" | "document" | "other";

export type Attachment = {
  id: string;
  name: string;
  url: string;
  type: AttachmentType;
};

export type Location = {
  id: string;
  name: string;
  description: string;
  attachments: Attachment[];
};

export type AssetType = "image" | "document" | "other";

export type Asset = {
  id: string;
  name: string;
  url: string;
  type: AssetType;
  size: number;
  uploadedAt: string;
};
