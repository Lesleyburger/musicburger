require('dotenv').config()

const { Client, Util } = require ('discord.js')
const ytdl = require('ytdl-core')
const Youtube = require('simple-youtube-api')
const { getURLVideoID } = require('ytdl-core')
const PREFIX = '*'

const client = new Client({ disableEveryone: true })

const youtube = new Youtube(process.env.GOOGLE_API_KEY)

const queue = new Map()

client.on("ready", async () => {

    console.log(`${client.user.username} is online!`);
    client.user.setActivity("Your favorite music", {type: "PLAYING"});
});

client.on('message', async message => {
    if(message.author.bot) return
    if(!message.content.startsWith(PREFIX)) return

    const args = message.content.substring(PREFIX.length).split(" ")
    const searchString = args.slice(1).join(' ')
    const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : ''
    const serverQueue = queue.get(message.guild.id)

    if(message.content.startsWith(`${PREFIX}play`)) {
        const voiceChannel = message.member.voice.channel
        if(!voiceChannel) return message.channel.send("you need to be in a voice channel to play music")
        const permissions = voiceChannel.permissionsFor(message.client.user)
        if(!permissions.has('CONNECT')) return message.channel.send("i dont have permission to connect to the voice channel")
        if(!permissions.has('SPEAK')) return message.channel.send("I don't have permissions to speak in the channel")

        if(url.match(/https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
            const playlist = await youtube.getPlaylist(url)
            const videos = await playlist.getVideos()
            for (const video of Object.values(video)) {
                const video2 = await youtube.getVideoByID(video.id)
                await handleVideo(video2, message, voiceChannel, true)
            }
            message.channel.send(`Playlist: **${playList.title}** has been added to the queue`)
            return undefined
        } else {
            try {
                var video = await youtube.getVideoByID(url)
            } catch {
                try {
                    var videos = await youtube.searchVideos(searchString, 1)
                    var video = await youtube.getVideoByID(videos[0].id)
                } catch {
                    return message.channel.send("I couldn't find any search results")
                }
            }
            return handleVideo(video, message, voiceChannel)
        }
    } else if (message.content.startsWith(`${PREFIX}stop`)) {
        if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to stop the music")
        if(!serverQueue) return message.channel.send("There is nothing playing")
        serverQueue.songs = []
        serverQueue.connection.dispatcher.end()
        message.channel.send("I have stopped the music for you")
        return undefined
    } else if (message.content.startsWith(`${PREFIX}skip`)) {
        if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to skip the music")
        if(!serverQueue) return message.channel.send("There is nothing playing")
        serverQueue.connection.dispatcher.end()
        message.channel.send("**skipped**")
        return undefined
    } else if (message.content.startsWith(`${PREFIX}volume`)) {
        if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to use music commands")
        if(!serverQueue) return message.channel.send("There is nothing playing")
        if(!args[1]) return message.channel.send(`That volume is: **${serverQueue.volume}**`)
        if(isNaN(args[1])) return message.channel.send("That is not a valid amount to change the volume")
        serverQueue.volume = args[1]
        serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5) 
        message.channel.send(`I have changed the volume to: **${args[1]}**`)
        return undefined
    } else if (message.content.startsWith(`${PREFIX}np`)) {
        if(!serverQueue) return message.channel.send("There is nothing playing")
        message.channel.send(`Now playing: **${serverQueue.songs[0].title}**`)
        return undefined
    } else if (message.content.startsWith(`${PREFIX}queue`)) {
        if(!serverQueue) return message.channel.send("There is nothing playing")
        message.channel.send(`
        __**Song Queue**__
        ${serverQueue.songs.map(song => `**-** ${song.title}`).join('\n')}
        **[ Now Playing:]** 
        ${serverQueue.songs[0].title}]
        `, { split: true })
        return undefined
    } else if (message.content.startsWith(`${PREFIX}pause`)) {
        if (!message.member.voice.channel)
          return message.channel.send("Please join voice channel first.");
        if (!message.member.hasPermission("ADMINISTRATOR"))
          return message.channel.send("Only adiminstarators can pause music.");
        if (!serverQueue) return message.channel.send("There is nothing playing.");
        if (!serverQueue.playing)
          return message.channel.send("The music is already paused.");
        serverQueue.playing = false;
        serverQueue.connection.dispatcher.pause();
        return message.channel.send("I have paused the music.");
      } else if (message.content.startsWith(`${PREFIX}resume`)) {
        if (!message.member.voice.channel)
          return message.channel.send("Please join voice channel first.");
        if (!message.member.hasPermission("ADMINISTRATOR"))
          return message.channel.send("Only adiminstarators can resume music.");
        if (!serverQueue) return message.channel.send("There is nothing playing.");
        if (serverQueue.playing)
          return message.channel.send("The music is already playing.");
        serverQueue.playing = true;
        serverQueue.connection.dispatcher.resume();
        return message.channel.send("I have resumed the music.");
        return undefined
    }
    return undefined
})

async function handleVideo(video, message, voiceChannel, playList = false) {
    const serverQueue = queue.get(message.guild.id)

    const song = {
        id: video.id,
        title: Util.escapeMarkdown(video.title),
        url: `https://www.youtube.com/watch?v=${video.id}`
    }

    if(!serverQueue) {
        const queueConstruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true
        }
        queue.set(message.guild.id, queueConstruct)

        queueConstruct.songs.push(song)

        try {
            var connection = await voiceChannel.join()
            queueConstruct.connection = connection
            play(message.guild, queueConstruct.songs[0])
        } catch (error) {
            console.log(`there was an error connecting to the voice channel: ${error}`)
            queue.delete(message.guild.id)
            message.channel.send(`There was an error connecting to the voice channel: ${error}`)
        }
    } else {
        serverQueue.songs.push(song)
        if(playList) return undefined
        else return message.channel.send(`**${song.title}** has been added to the queue`)
    }
    return undefined
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id)

    const dispatcher = serverQueue.connection.play(ytdl(song.url))
    .on('finish', () => {
        serverQueue.songs.shift()
        play(guild, serverQueue.songs[0])
    })
    .on('error', error => {
        console.log(error)
    })
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5)

    serverQueue.textChannel.send(`Start Playing: **${song.title}**`)
}

client.login(process.env.TOKEN)