import { MenuOption } from "./menu_option";

export interface Rol {
    id: string;
    strName: string;
    strDescription1: string;
    strDescription2: string;
    menuOptions: MenuOption[];
  }  