import { Markup } from 'telegraf'
import { v4 } from 'uuid'
import moment from 'moment'

import { MessageStorage } from './MessageStorage' // eslint-disable-line

/**
 * @typedef {('ban'|'spam'|'mute')} PollType
 */

function pastWord (word) {
  switch (word) {
    case 'ban':
      return 'banned'
    case 'mute':
      return 'muted'
    case 'spam':
      return 'reported as a spammer'
    default:
      return 'DOSMOT?'
  }
}

function getUserName ({ first_name: firstName, last_name: lastName, username }) {
  let result = ''

  if (firstName) {
    result += firstName
  }
  if (lastName) {
    result += ' ' + lastName
  }
  if (username) {
    result += ` (@${username})`
  }

  return result
}

export class Poll {
  punishVotes = []
  saveVotes = []

  constructor ({ chatId, initiator, victim }, type) {
    this.id = v4()
    this.chatId = chatId
    this.initiator = initiator
    this.victim = victim
    this.createdAt = new Date()
    this.type = type
  }

  removeVoteIfExists (user) {
    const punishIndex = this.punishVotes.findIndex(item => item.id === user.id)
    const saveIndex = this.saveVotes.findIndex(item => item.id === user.id)
    if (punishIndex >= 0) {
      this.punishVotes.splice(punishIndex, 1)
    }
    if (saveIndex >= 0) {
      this.saveVotes.splice(punishIndex, 1)
    }
  }

  votePunish (user) {
    this.removeVoteIfExists(user)
    this.punishVotes.push(user)
    this.updateCallback()
  }

  voteSave (user) {
    this.removeVoteIfExists(user)
    this.saveVotes.push(user)
    this.updateCallback()
  }

  getMessage () {
    switch (this.getStatus()) {
      case 'punished':
        return {
          text: `${getUserName(this.victim)} was ${pastWord(this.type)} by voting.
          Say thanks to ${this.punishVotes.map(vote => vote.first_name).join(', ')}!`,
          extra: ''
        }

      case 'saved':
        return {
          text: `${getUserName(this.victim)} was saved by voting.
          Say thanks to ${this.saveVotes.map(vote => vote.first_name).join(', ')}!`,
          extra: ''
        }

      case 'pending':
      default:
        return {
          text: `User ${this.initiator.first_name} wants to ${this.type === 'spam' ? 'ban for spam' : this.type} ${this.victim.first_name}`,
          extra: Markup.inlineKeyboard([
            Markup.callbackButton(`${this.type} (${this.punishVotes.length}/5)`, `votepunish:${this.id}`),
            Markup.callbackButton(`Save (${this.saveVotes.length}/5)`, `votesave:${this.id}`)
          ]).extra()
        }
    }
  }

  getStatus () {
    if (this.saveVotes.length >= 1) {
      return 'saved'
    }
    if (this.punishVotes.length >= 1) {
      return 'punished'
    }
    return 'pending'
  }
}

export class PollManager {
  activePolls = new Map();

  /**
   * Creates a poll manager
   * @param {*} bot
   * @param {MessageStorage} storage
   */
  constructor (bot, storage) {
    this.bot = bot
    this.storage = storage
  }

  createPoll (params, type) {
    const { activePolls } = this
    const { telegram } = this.bot

    const poll = new Poll(params, type)
    activePolls.set(poll.id, poll)

    const { text, extra } = poll.getMessage()
    telegram
      .sendMessage(params.chatId, text, extra)
      .then(({ message_id: messageId, chat: { id: chatId } }) => {
        poll.updateCallback = async () => {
          const currentStatus = poll.getStatus()
          if (currentStatus === 'punished') {
            if (type === 'ban') {
              await telegram.kickChatMember(chatId, poll.victim.id, 0)
            } else if (type === 'mute') {
              await telegram.restrictChatMember(
                chatId,
                poll.victim.id,
                {
                  until_date: moment().add(1, 'day').format('x'),
                  can_send_messages: false,
                  can_send_media_messages: false,
                  can_send_other_messages: false,
                  can_add_web_page_previews: false
                }
              )
            } else if (type === 'spam') {
              const messages = this.storage.getUserMessagesInChat(poll.victim.id, chatId)
              for (let i = 0; i < messages.length; i += 1) {
                const { chatId, messageId } = messages[i]
                await telegram.deleteMessage(chatId, messageId)
              }
              await telegram.kickChatMember(chatId, poll.victim.id, 0)
              this.storage.deleteUserMessages(poll.victim.id)
            }
          }

          if (currentStatus === 'saved' || currentStatus === 'punished') {
            activePolls.delete(poll.id)
          }

          const currentMessage = poll.getMessage()
          telegram.editMessageText(chatId, messageId, messageId, currentMessage.text, currentMessage.extra)
        }
      })
  }
}
