import { ValidationService } from '../../services/validation.service';
import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {SessionService} from "../../services/session.service";
import {CommunitiesService} from "../../services/communities.service";
import {MessagesService} from "../../services/messages.service";
import {IMessage} from "../../../types/models/IMessage";
import {IChat} from "../../../types/models/IChat";
import {UserChatsService} from "../../services/user-chats.service";
import {MatDialog} from "@angular/material/dialog";
import {CreateGroupDialogComponent} from "../dialogs/create-group-dialog/create-group-dialog.component";
import {CommunityType} from "../../../types/enums/CommunityType";
import * as signalR from '@microsoft/signalr';
import {Subscription} from "rxjs";
import {IUser} from "../../../types/models/IUser";
import {UsersService} from "../../services/users.service";
import {EditMessageCommand} from "../../../types/requests/EditMessageCommand";
import {IEditMessageNotification} from "../../../types/models/IEditMessageNotification";
import {DocumentsService} from "../../services/documents.service";
import {AutoUnsubscribe} from "ngx-auto-unsubscribe";
import {environment} from "../../../environments/environment";
import {ErrorNotificationService} from "../../services/error-notification.service";
import {IDeleteMessageNotification} from "../../../types/models/IDeleteMessageNotification";

@AutoUnsubscribe()
@Component({
  selector: 'app-main',
  templateUrl: './main.component.html'
})
export class MainComponent implements OnInit, OnDestroy {

  private routeChatId = this.route.snapshot.paramMap.get('chatId');
  private readonly userId: string | undefined = this.sessionService.getTokens()?.userId;
  private connectionBuilder: signalR.HubConnectionBuilder = new signalR.HubConnectionBuilder();
  private connection: signalR.HubConnection = this.connectionBuilder
    .configureLogging(signalR.LogLevel.Information)
    .withUrl(environment.baseUrl + 'notify')
    .build();
  private signalRConnected = false;

  public messages: IMessage[] = [];
  public chats: IChat[] = [];
  public realTimeConnections: string[] = [];
  public editMessageRequest: EditMessageCommand | null = null;
  public replayMessageObject: any | null = null;
  public activeChatId = '';

  public currentUser: IUser = {
    address: "",
    bio: "",
    birthdayDate: "",
    displayName: "",
    email: "",
    facebook: "",
    firstName: "",
    instagram: "",
    lastName: "",
    linkedIn: "",
    pictureUrl: "",
    publicKey: 0,
    twitter: "",
    userId: "",
    username: "",
    website: ""
  }

  public activeChat: IChat = {
    lastMessageId: "",
    lastMessageAuthor: "",
    lastMessageText: "",
    lastMessageTime: "",
    updatedAt: "",
    roleId: 1,
    communityType: CommunityType.PublicChannel,
    description: "",
    chatId: "",
    chatLogoImageUrl: "",
    isArchived: false,
    isMember: false,
    membersCount: 0,
    title: ""
  };

  public chatFilter = 'All Chats';
  public chatSearchQuery = '';
  public messageSearchQuery = '';
  public messageInputOpened = false;

  protected getUsersChatSub$!: Subscription;
  protected getCurrentUserSub$!: Subscription;
  protected getChatMessagesSub$!: Subscription;
  protected onFilterClickSub$!: Subscription;
  protected searchSub$!: Subscription;
  protected archiveSub$!: Subscription;
  protected deleteChatSub$!: Subscription;
  protected onChatLeaveUserSub$!: Subscription;
  protected searchMessageSub$!: Subscription;
  protected updateChatLogoSub$!: Subscription;

  constructor(private sessionService: SessionService,
              private chatService: CommunitiesService,
              private messageService: MessagesService,
              private userChatsService: UserChatsService,
              public userService: UsersService,
              private route: ActivatedRoute,
              private documentService: DocumentsService,
              private validationService: ValidationService,
              private router: Router,
              public dialog: MatDialog,
              private errorNotificationService: ErrorNotificationService) {
  }

  openCreateGroupDialog = () => this.dialog.open(CreateGroupDialogComponent);

  ngOnInit(): void {
    this.initializeView();
  }

  initializeView(): void {
    this.getUsersChatSub$ = this.chatService.getUserChats().subscribe(chatsResponse => {

      this.chats = chatsResponse.chats.filter(x => !x.isArchived);

      if (this.connection.state !== signalR.HubConnectionState.Connected) {
        this.connectChatsToHub();
      }

      if (this.routeChatId) {
        this.loadMessages(this.routeChatId);
        return;
      }

      const firstChat = this.chats[0];

      if (firstChat) {
        this.loadMessages(firstChat.chatId);
        return;
      }

      if (!this.activeChatId) {
        const userId = this.userId as string;
        this.getCurrentUserSub$ = this.userService.getUserById(userId).subscribe(data => this.currentUser = data.user);
      }
    }, error => {
      this.errorNotificationService.notifyOnError(error);

      if (error.status === 403 || error.status === 0) {
        this.router.navigateByUrl('login').then(r => r);
        return;
      }
    });

    if (!this.signalRConnected) {
      this.setSignalRMethods();
      this.signalRConnected = true;
    }
  }

  connectChatsToHub(): void {
    this.connection.start().then(() => {
      this.chats.forEach(x => {
        if (this.realTimeConnections.includes(x.chatId)) {
          return;
        }

        this.connection.invoke("JoinGroup", x.chatId).then(() => this.realTimeConnections.push(x.chatId));
      });

      if (this.userId != null && this.realTimeConnections.includes(this.userId)) {
        return;
      }

      this.connection.invoke("JoinGroup", this.userId).then(r => r);

    }).catch(err => console.error(err.toString()));
  }

  setSignalRMethods(): void {
    this.connection.on("BroadcastMessageAsync", (message: IMessage) => this.onBroadcastMessage(message));

    this.connection.on("UpdateUserChatsAsync", (chat: IChat) => this.chats.push(chat));

    this.connection.on('NotifyOnMessageDeleteAsync', (notification: IDeleteMessageNotification) => {
        let message = this.messages.filter(x => x.messageId === notification.messageId)[0];

        if(message.messageId === this.activeChat.lastMessageId) {
          this.activeChat.lastMessageAuthor = notification.newLastMessageAuthor;
          this.activeChat.lastMessageText = notification.newLastMessageText;
          this.activeChat.lastMessageTime = notification.newLastMessageTime;
          this.activeChat.lastMessageId = notification.newLastMessageId;
        }


        this.messages = this.messages.filter(x => x.messageId !== notification.messageId);
      }
    );

    this.connection.on('NotifyOnMessageEditAsync', (notification: IEditMessageNotification) => {
      let message = this.messages.filter(x => x.messageId === notification.messageId)[0];

      if (message) {
        message.messageText = notification.modifiedText;
        message.updatedAt = notification.updatedAt;
      }

      if (notification.isLastMessage) {
        this.activeChat.lastMessageText = notification.modifiedText;
        this.activeChat.lastMessageTime = notification.updatedAt;
      }
    });
  }

  onBroadcastMessage(message: IMessage): void {
    message.self = message.userId == this.userId;
    let chat = this.chats.filter(x => x.chatId === message.chatId)[0];
    chat.lastMessageAuthor = message.userDisplayName;
    chat.lastMessageText = message.messageText;
    chat.lastMessageTime = message.createdAt;
    chat.lastMessageId = message.messageId;
    this.chats = this.chats.filter(x => x.chatId !== message.chatId);
    this.chats = [chat, ...this.chats];

    if (message.chatId === this.activeChatId) {
      this.messages.push(message);
    }

    this.scrollToEnd();
  }

  navigateContacts = () => this.router.navigateByUrl('contacts').then(r => r);

  private loadMessages(chatId: string | null): void {
    if (chatId == null) return;

    this.getChatMessagesSub$ = this.messageService.getChatMessages(chatId).subscribe(response => {
      this.messages = response.messages;
      this.activeChatId = chatId;
      this.activeChat = this.chats.filter(x => x.chatId === this.activeChatId)[0];
      this.scrollToEnd();
    }, error => {
      this.errorNotificationService.notifyOnError(error);
    });
  }

  navigateToChat(chatId: string): void {
    if (this.activeChatId === chatId) return;

    this.router.navigate(['main', {chatId: chatId}]).then(() => {
      this.loadMessages(chatId);

      if (!this.realTimeConnections.includes(chatId)) {
        this.connection.invoke("JoinGroup", chatId).then(() => {
          this.realTimeConnections.push(chatId);
        });
      }
    });
  }

  scrollToEnd = () => setTimeout(() =>
    document.getElementById('messageList')?.scrollIntoView({block: "end"}));


  onChatFilerClick(filer: string): void {

    this.onFilterClickSub$ = this.chatService.getUserChats().subscribe(getUserChatsResponse => {
      switch (filer) {
        case 'All Chats':
          this.initializeView();
          break;
        case 'Groups':
          this.chats = getUserChatsResponse.chats
            .filter(x => !x.isArchived)
            .filter(x => x.communityType === CommunityType.PublicChannel);
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
      this.chatSearchQuery = '';
    });
  }

  onSearchClick(): void {
    this.validationService.validateField(this.chatSearchQuery, 'Chat Search');
    this.searchSub$ = this.chatService.searchChat(this.chatSearchQuery).subscribe(response => {
      this.chats = response.chats;
      this.chatFilter = 'Search Results';
      this.chatSearchQuery = '';
    }, error => {
      this.errorNotificationService.notifyOnError(error);
    });
  }

  onArchiveChatClick(): void {
    this.archiveSub$ =
      this.userChatsService.archiveCommunity(this.activeChatId).subscribe(_ => {
        this.chats = this.chats.filter(x => x.chatId !== this.activeChatId);
        this.activeChat.isArchived = !this.activeChat.isArchived;
      }, error => {
        this.errorNotificationService.notifyOnError(error);
      });
  }

  onLeaveChatClick(): void {
    this.deleteChatSub$ = this.userChatsService.leaveCommunity(this.activeChatId).subscribe(_ => {
      this.chats = this.chats.filter(x => x.chatId !== this.activeChatId);

      if (this.chats[0]) {
        this.activeChatId = this.chats[0].chatId;
        this.router.navigateByUrl('main').then(r => r);
        this.loadMessages(this.activeChatId);
        return;
      }

      this.activeChatId = '';

      const userId = this.userId as string;
      this.onChatLeaveUserSub$ = this.userService.getUserById(userId).subscribe(data => {
        this.currentUser = data.user;
        this.router.navigateByUrl('main').then(r => r);
      });
    }, error => {
      this.errorNotificationService.notifyOnError(error);
    });
  }

  getMessageComponentClass = (chat: IChat) => chat.chatId === this.activeChatId
    ? 'contacts-item friends active'
    : 'contacts-item friends';


  onEditMessageEvent(event: any) {
    if (!this.activeChat.isMember) {
      alert('You are not a member of the chat to edit messages.');
      return;
    }


    const messageId = event.messageId;
    const messageText = event.messageText;

    if (!messageId || !messageText) {
      return;
    }

    const chatId = this.activeChatId;
    this.editMessageRequest = new EditMessageCommand(messageId, chatId, messageText);
  }

  onJoinGroupEvent() {
    this.activeChat.isMember = true;
    this.chatFilter = 'All Chats';
    this.initializeView();
  }

  getChatImageUrl = () => this.activeChat?.chatLogoImageUrl ?? 'assets/media/avatar/3.png';


  filterMessages(): void {
    this.validationService.validateField(this.messageSearchQuery, 'Chat Search');
    this.searchMessageSub$ =
      this.messageService.searchMessages(this.activeChatId, this.messageSearchQuery).subscribe(response => {
        this.messages = response.messages;
        this.messageSearchQuery = '';
      }, error => {
        this.errorNotificationService.notifyOnError(error);
      });
  }

  onFilterMessageDropdownClick() {
    this.loadMessages(this.activeChatId);
    this.messageInputOpened = !this.messageInputOpened;
  };

  onReplayMessageClick = (event: any) => {
    if (!this.activeChat.isMember) {
      alert('You are not a member of the chat to reply messages.');
      return;
    }

    return this.replayMessageObject = {
      messageAuthor: event.messageAuthor,
      messageText: event.messageText
    };
  };


  hasActiveChat = () => this.activeChatId !== '';

  onChangePictureClick(): void {

    const validChat = this.activeChat.communityType === CommunityType.PublicChannel;

    const validRole = this.activeChat.roleId > 1;

    if (!validChat || !validRole) {
      return;
    }

    const dialog = document.getElementById('change-chat-logo');
    dialog?.click();
  }

  onChatImageChange(event: any): void {
    const file: File = event.target.files[0];

    if (file === null || file === undefined) {
      return;
    }

    const split = file.name.split('.');
    const extension = split.pop();

    const properFileFormat =
      extension === 'jpg' ||
      extension === 'JPG' ||
      extension === 'png' ||
      extension === 'PNG';

    if (!properFileFormat) {
      alert('Wrong file format.');
      return;
    }

    const form = new FormData();
    form.append("newGroupPicture", file);


    const chatId = this.activeChatId;

    this.updateChatLogoSub$ = this.chatService.updateChatLogo(chatId, form).subscribe(response => {
      this.activeChat.chatLogoImageUrl = response.updatedLogoUrl;
      alert(response.message);
    });
  }

  ngOnDestroy(): void {
    this.connection.stop().then(r => r);
  }
}
