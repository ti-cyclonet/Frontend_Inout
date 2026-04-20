import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { OptionMenu } from '../../model/option_menu';

@Component({
  selector: 'app-sidebar-list',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar-list.component.html',
  styleUrls: ['./sidebar-list.component.css']
})
export class SidebarListComponent implements OnInit {
  @Input() optionsMenu: OptionMenu[] = [];
  @Output() sidebarToggle = new EventEmitter<void>();

  ngOnInit(): void {
    this.optionsMenu.sort((a, b) => {
      const orderA = a.order ? parseInt(a.order, 10) : 99;
      const orderB = b.order ? parseInt(b.order, 10) : 99;
      return orderA - orderB;
    });
  }

  onItemClick(): void {
    this.sidebarToggle.emit();
  }
}
