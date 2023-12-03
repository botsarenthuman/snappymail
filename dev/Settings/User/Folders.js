import ko from 'ko';

import { Notifications } from 'Common/Enums';
import { FolderMetadataKeys } from 'Common/EnumsUser';
import { addEventsListeners } from 'Common/Globals';
import { getNotification } from 'Common/Translator';

import { getFolderFromCacheList, removeFolderFromCacheList } from 'Common/Cache';
import { defaultOptionsAfterRender } from 'Common/Utils';
import { initOnStartOrLangChange, i18n } from 'Common/Translator';

import { FolderUserStore } from 'Stores/User/Folder';
import { SettingsUserStore } from 'Stores/User/Settings';

import Remote from 'Remote/User/Fetch';

import { showScreenPopup } from 'Knoin/Knoin';

import { FolderCreatePopupView } from 'View/Popup/FolderCreate';
import { FolderSystemPopupView } from 'View/Popup/FolderSystem';

const folderForDeletion = ko.observable(null).askDeleteHelper();

export class UserSettingsFolders /*extends AbstractViewSettings*/ {
	constructor() {
		this.showKolab = FolderUserStore.allowKolab();
		this.defaultOptionsAfterRender = defaultOptionsAfterRender;
		this.kolabTypeOptions = ko.observableArray();
		let i18nFilter = key => i18n('SETTINGS_FOLDERS/TYPE_' + key);
		initOnStartOrLangChange(()=>{
			this.kolabTypeOptions([
				{ id: '', name: '' },
				{ id: 'event', name: i18nFilter('CALENDAR') },
				{ id: 'contact', name: i18nFilter('CONTACTS') },
				{ id: 'task', name: i18nFilter('TASKS') },
				{ id: 'note', name: i18nFilter('NOTES') },
				{ id: 'file', name: i18nFilter('FILES') },
				{ id: 'journal', name: i18nFilter('JOURNAL') },
				{ id: 'configuration', name: i18nFilter('CONFIGURATION') }
			]);
		});

		this.displaySpecSetting = FolderUserStore.displaySpecSetting;
		this.folderList = FolderUserStore.folderList;
		this.folderListOptimized = FolderUserStore.optimized;
		this.folderListError = FolderUserStore.error;
		this.hideUnsubscribed = SettingsUserStore.hideUnsubscribed;
		this.unhideKolabFolders = SettingsUserStore.unhideKolabFolders;

		this.loading = FolderUserStore.foldersChanging;

		this.folderForDeletion = folderForDeletion;

		SettingsUserStore.hideUnsubscribed.subscribe(value => Remote.saveSetting('HideUnsubscribed', value));
		SettingsUserStore.unhideKolabFolders.subscribe(value => Remote.saveSetting('UnhideKolabFolders', value));
	}

	onShow() {
		FolderUserStore.error('');
	}
/*
	onBuild(oDom) {
	}
*/

	/**
	 * @param {FolderModel} folder
	 * @param {*} event
	 */
	onDragStart(folder, event) {
		let element = event.target,
			parent = element.parentNode;
		this.dragData = {
			action: 'RENAME',
			folder: folder,
			element: element
		};
//		event.dataTransfer.setData(rlContentType, 'RENAME');
		event.dataTransfer.setData('text/plain', 'snappymail/folder/RENAME');
		event.dataTransfer.setDragImage(element, 0, 0);
		event.dataTransfer.effectAllowed = 'move';
		setTimeout(() => element.style.opacity = 0.25, 100);

		if (!parent.sortable) {
			parent.sortable = true;
			const fnHover = e => {
				const dragData = this.dragData;
				if (dragData) {
					e.preventDefault();
					let node = (e.target.closest ? e.target : e.target.parentNode).closest('[draggable]');
					if (node && node !== dragData.element && parent.contains(node)) {
						let rect = node.getBoundingClientRect();
						if (rect.top + (rect.height / 2) <= e.clientY) {
							if (node.nextElementSibling !== dragData.element) {
								node.after(dragData.element);
							}
						} else if (node.previousElementSibling !== dragData.element) {
							node.before(dragData.element);
						}
						// class="deep-N"
					}
				}
			};
			addEventsListeners(parent, {
				dragenter: fnHover,
				dragover: fnHover,
				drop: e => {
					const dragData = this.dragData;
					if (dragData) {
						e.preventDefault();
/*
						let data = ko.dataFor(dragData.element),
							from = options.list.indexOf(data),
							to = [...parent.children].indexOf(dragData.element);
						if (from != to) {
							let arr = options.list();
							arr.splice(to, 0, ...arr.splice(from, 1));
							options.list(arr);
						}
						this.dragData = null;
						options.afterMove?.();
*/
					}
				}
			});
		}

		return true;
	}

	onDragEnd() {
		event.target.style.opacity = null;
		this.dragData = null;
	}

	createFolder() {
		showScreenPopup(FolderCreatePopupView);
	}

	systemFolder() {
		showScreenPopup(FolderSystemPopupView);
	}

	deleteFolder(folderToRemove) {
		if (folderToRemove
		 && folderToRemove.canBeDeleted()
		 && folderToRemove.askDelete()
		) {
			if (0 < folderToRemove.totalEmails()) {
//				FolderUserStore.error(getNotification(Notifications.CantDeleteNonEmptyFolder));
				folderToRemove.errorMsg(getNotification(Notifications.CantDeleteNonEmptyFolder));
			} else {
				folderForDeletion(null);

				if (folderToRemove) {
					Remote.abort('Folders').post('FolderDelete', FolderUserStore.foldersDeleting, {
							folder: folderToRemove.fullName
						}).then(
							() => {
//								folderToRemove.attributes.push('\\nonexistent');
								folderToRemove.selectable(false);
//								folderToRemove.isSubscribed(false);
//								folderToRemove.checkable(false);
								if (!folderToRemove.subFolders.length) {
									removeFolderFromCacheList(folderToRemove.fullName);
									const folder = getFolderFromCacheList(folderToRemove.parentName);
									(folder ? folder.subFolders : FolderUserStore.folderList).remove(folderToRemove);
								}
							},
							error => {
								FolderUserStore.error(
									getNotification(error.code, '', Notifications.CantDeleteFolder)
									+ '.\n' + error.message
								);
							}
						);
				}
			}
		}
	}

	hideError() {
		this.error('');
	}

	toggleFolderKolabType(folder, event) {
		let type = event.target.value;
		// TODO: append '.default' ?
		Remote.request('FolderSetMetadata', null, {
			folder: folder.fullName,
			key: FolderMetadataKeys.KolabFolderType,
			value: type
		});
		folder.kolabType(type);
	}

	toggleFolderSubscription(folder) {
		let subscribe = !folder.isSubscribed();
		Remote.request('FolderSubscribe', null, {
			folder: folder.fullName,
			subscribe: subscribe ? 1 : 0
		});
		folder.isSubscribed(subscribe);
	}

	toggleFolderCheckable(folder) {
		let checkable = !folder.checkable();
		Remote.request('FolderCheckable', null, {
			folder: folder.fullName,
			checkable: checkable ? 1 : 0
		});
		folder.checkable(checkable);
	}
}
