import { Markup } from 'telegraf'
import { v4 } from 'uuid'
import moment from 'moment'

function pastWord (word) {
  switch (word) {
    case 'ban':
      return 'banned'
    case 'mute':
      return 'muted'
    default:
      return 'DOSMOT?'
  }
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
          text: `${this.victim.first_name} was ${pastWord(this.type)} by voting. Thanks ${this.saveVotes.map(vote => vote.first_name).join(', ')}!`,
          extra: ''
        }

      case 'saved':
        return {
          text: `${this.victim.first_name} was saved by voting. Thanks ${this.saveVotes.map(vote => vote.first_name).join(', ')}!`,
          extra: ''
        }

      case 'pending':
      default:
        return {
          text: `User ${this.initiator.first_name} wants to ${this.type} ${this.victim.first_name}`,
          extra: Markup.inlineKeyboard([
            Markup.callbackButton(`Punish (${this.punishVotes.length}/5)`, `votepunish:${this.id}`),
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

  constructor (bot) {
    this.bot = bot
  }

  createPoll (params, type) {
    const { activePolls } = this
    const { telegram } = this.bot

    const poll = new Poll(params, type)
    activePolls.set(poll.id, poll)

    const { text, extra } = poll.getMessage()
    telegram
      .sendMessage(params.chatId, text, extra)
      .then(({ message_id, chat: { id } }) => {
        poll.updateCallback = async () => {
          const currentStatus = poll.getStatus()
          if (currentStatus === 'punished') {
            if (type === 'ban') {
              await telegram.kickChatMember(id, poll.victim.id, 0)
            } else if (type === 'mute') {
              await telegram.restrictChatMember(
                id,
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
              await telegram.kickChatMember(id, poll.victim.id, 0)
            }
          }

          if (currentStatus === 'saved' || currentStatus === 'punished') {
            activePolls.delete(poll.id)
          }

          const currentMessage = poll.getMessage()
          telegram.editMessageText(id, message_id, message_id, currentMessage.text, currentMessage.extra)
        }
      })
  }
}
