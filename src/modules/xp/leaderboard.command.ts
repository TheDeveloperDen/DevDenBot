import {CommandInteraction, GuildMember} from 'discord.js'

import {
	APIApplicationCommandOptionChoice
} from 'discord-api-types/payloads/v10/_interactions/_applicationCommands/_chatInput/shared'
import {DDUser} from '../../store/models/DDUser.js'
import {Command} from 'djs-slash-helper'
import {ApplicationCommandOptionType, ApplicationCommandType} from 'discord-api-types/v10'
import {createStandardEmbed} from '../../util/embeds.js'
import {branding} from '../../util/branding.js'
import {actualMention} from '../../util/users.js'

interface LeaderboardType extends APIApplicationCommandOptionChoice<string> {
	calculate?: (user: DDUser) => number,

	format(value: number): string,

	value: keyof DDUser
}

const info: LeaderboardType[] = [
	{value: 'xp', name: 'XP', format: value => `${value} XP`},
	{value: 'level', name: 'Level', format: value => `Level ${value}`},
	{
		value: 'currentDailyStreak',
		name: 'Current Daily Streak',
		format: s => `${formatDays(s)}`
	},
	{
		value: 'highestDailyStreak',
		name: 'Highest Daily Streak',
		format: s => `${formatDays(s)}`
	}
]

export const LeaderboardCommand: Command<ApplicationCommandType.ChatInput> = {
	type: ApplicationCommandType.ChatInput,
	name: 'leaderboard',
	description: 'Show the top 10 users based on XP, Level, or Daily Streak',
	options: [{
		type: ApplicationCommandOptionType.String,
		name: 'type',
		description: 'The type of leaderboard to show',
		required: true,
		choices: info
	}],

	async handle(interaction: CommandInteraction) {
		await interaction.deferReply()
		const guild = interaction.guild
		if (!guild) {
			await interaction.followUp('This command can only be used in a server')
			return
		}
		const option = interaction.options.getString('type', true)
		const traitInfo = info.find(it => it.value == option)
		if (!traitInfo) {
			await interaction.followUp('Invalid leaderboard type')
			return
		}
		const {format, value, name} = traitInfo
		const calculate = traitInfo.calculate ?? ((user: DDUser) => user[value])
		const users = await DDUser.findAll({
			order: [[value, 'DESC']],
			limit: 10
		}).then(users => users.filter(it => it[value] > 0))
		if (users.length == 0) {
			await interaction.followUp('No applicable users')
			return
		}
		const embed = {
			...createStandardEmbed(interaction.member as GuildMember),
			title: `${branding.name} Leaderboard`,
			description: `The top ${users.length} users based on ${name}`,
			fields: await Promise.all(users.map(async (user, index) => {
				const discordUser = await guild.client.users.fetch(user.id.toString()).catch(() => null)
				return {
					name: `#${index + 1} - ${format(calculate(user))}`,
					value: discordUser == null ? 'Unknown User' : actualMention(discordUser)
				}
			}))
		}
		await interaction.followUp({embeds: [embed]})
	}
}

function formatDays(days: number) {
	if (days == 1) {
		return '1 day'
	}
	return `${days} days`
}
