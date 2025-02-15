import { Rol } from "./rol";

export interface Application {
  id: string;
  strName: string;
  strDescription: string;
  strUrlImage: string;
  strSlug: string;
  strTags: string[];
  strImages: string[];
  strRoles: Rol[];
}