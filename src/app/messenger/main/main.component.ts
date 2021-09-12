import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {SessionService} from "../../services/session.service";
import {ChatsService} from "../../services/chats.service";
import {MessagesService} from "../../services/messages.service";
import {IMessage} from "../../../types/models/IMessage";
import {IChat} from "../../../types/models/IChat";
import {UserChatsService} from "../../services/user-chats.service";
import {ArchiveChatCommand} from "../../../types/requests/ArchiveChatCommand";
import {MatDialog} from "@angular/material/dialog";
import {CreateGroupDialogComponent} from "../dialogs/create-group-dialog/create-group-dialog.component";
import {CryptoService} from "../../services/crypto.service";
import {CommunityType} from "../../../types/enums/CommunityType";

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html'
})
export class MainComponent implements OnInit {

  messages: IMessage[] = [];
  chats: IChat[] = [];

  activeChatId = '';

  activeChat: IChat = {
    communityType: CommunityType.PublicChannel,
    lastMessage: null,
    description: "",
    chatId: "",
    chatLogoImageUrl: "",
    isArchived: false,
    isMember: false,
    membersCount: 0,
    title: ""
  };

  chatFilter = 'All Chats';
  searchQuery = '';

  constructor(private sessionService: SessionService,
              private chatService: ChatsService,
              private messageService: MessagesService,
              private userChatsService: UserChatsService,
              private route: ActivatedRoute,
              private router: Router,
              public dialog: MatDialog,
              private cryptoService: CryptoService) {
  }

  openCreateGroupDialog(): void {
    this.dialog.open(CreateGroupDialogComponent);
  }

  ngOnInit(): void {
    this.initializeView();
  }

  initializeView(): void {
    this.chatService.getUserChats().subscribe(getUserChatsResponse => {
      this.chatFilter = 'All Chats';
      this.chats = getUserChatsResponse.chats.filter(x => !x.isArchived);

      const firstChat = getUserChatsResponse.chats[0];
      if (firstChat) {
        this.loadChatAndMessages(firstChat.chatId);
      }
    }, error => {
      if (error.status === 403) {
        this.router.navigateByUrl('login').then(r => r);
        return;
      }

      alert(error.error.ErrorMessage);
    });
  }

  loadChatAndMessages(chatId: string): void {
    this.messageService.getChatMessages(chatId).subscribe(getMessagesResponse => {
        this.messages = getMessagesResponse.messages;
        this.activeChatId = chatId;
        this.chatService.getChatById(chatId).subscribe(getChatByIdResponse => {
          if (getChatByIdResponse) {
            this.activeChat = getChatByIdResponse.chat;
            this.scrollToEnd();
          }
        }, error => {
          alert(error.error.ErrorMessage);
        })
      },
      error => {
        alert(error.error.ErrorMessage);
      });
  }

  scrollToEnd(): void {
    setTimeout(() => {
      let element = document.getElementById('messageList');
      element?.scrollIntoView({block: "end"});
    }, 0);
  }

  onChatFilerClick(filer: string): void {
    this.chatService.getUserChats().subscribe(getUserChatsResponse => {

      switch (filer) {
        case 'All Chats':
          this.chats = getUserChatsResponse.chats.filter(x => !x.isArchived);
          const firstChat = getUserChatsResponse.chats[0];
          if (firstChat) {
            this.loadChatAndMessages(firstChat.chatId);
          }
          break;
        case 'Groups':
          console.log(getUserChatsResponse.chats);
          this.chats = getUserChatsResponse.chats.filter(x => x.communityType === CommunityType.ReadOnlyChannel
            || x.communityType === CommunityType.PublicChannel
            || x.communityType === CommunityType.PrivateChannel);
          break;
        case 'Direct Chats':
          this.chats = getUserChatsResponse.chats.filter(x => x.communityType === CommunityType.DirectChat);
          break;
        case 'Archived':
          this.chats = getUserChatsResponse.chats.filter(x => x.isArchived);
          break;
        default:
          break;
      }

      this.chatFilter = filer;
      this.searchQuery = '';
    });
  }

  onSearchClick(): void {
    this.chatService.searchChat(this.searchQuery).subscribe(getUserChatsResponse => {
      this.chats = getUserChatsResponse.chats;
      this.chatFilter = 'Search Results';
    }, error => {
      alert(error.error.ErrorMessage);
    })
  }

  onArchiveChatClick(): void {
    this.chatService.getUserChats().subscribe(getUserChatsResponse => {
      const chat = getUserChatsResponse.chats.filter(x => x.chatId === this.activeChatId)[0];
      const command = new ArchiveChatCommand(this.activeChatId, !chat.isArchived);

      this.userChatsService.putArchiveChat(command).subscribe(_ => {
        this.initializeView();
      }, error => {
        alert(error.error.ErrorMessage);
      })
    }, error => {
      alert(error.error.ErrorMessage);
    })
  }

  onLeaveChatClick(): void {
    this.userChatsService.deleteLeaveChat(this.activeChatId).subscribe(_ => {
      this.activeChatId = '';
      this.onChatFilerClick('All Chats');
    }, error => {
      alert(error.error.ErrorMessage);
    })
  }

  getMessageComponentClass(chat: IChat): string {
    return chat.chatId === this.activeChatId ? 'contacts-item friends active' : 'contacts-item friends';
  }

  onDeleteMessageEvent(messageId: string) {
    this.messages = this.messages.filter(x => x.messageId !== messageId);
  }

  onJoinGroupEvent() {
    this.initializeView();
  }

  noActiveChat(): boolean {
    return this.activeChatId !== '';
  }
}
