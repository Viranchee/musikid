const vscode = require('vscode');
const { exec, spawn, ChildProcess } = require('child_process');

/**
 * @param {ChildProcess} youtubeDLProcess
*/
let youtubeDLProcess = null;
let ffplayProcess = null;
let canPlay = false;
let stopMusicFlag = false;

/**
 * @param {string} url
 */
function isPlaylist(url) {
	return url.includes('playlist');
}

/**
 * @param {string} url
 */
function isURL(url) {
	return url.includes('http');
}

function precheckCommand() {
	// Check dependencies
	const ytdlpath = vscode.workspace.getConfiguration('musikid').get('youtube-dl-path');
	// Check if the path is valid
	exec(`${ytdlpath} --version`, (err, _stdout, _stderr) => {
		if (err) {
			vscode.window.showErrorMessage(`Musikid: youtube-dl path is invalid`);
			return;
		}
	});
	exec(`ffplay -version`, (err, _stdout, _stderr) => {
		if (err) {
			vscode.window.showErrorMessage(`Musikid: ffplay is not installed`);
			return;
		}
	});
	vscode.window.showInformationMessage(`Musikid is ready to stream music!`);
	canPlay = true;
}

function stopMusicCommand() {
	if (canPlay) {
		if (youtubeDLProcess) {
			youtubeDLProcess.kill();
			youtubeDLProcess = null;
		}
		if (ffplayProcess) {
			ffplayProcess.kill();
			ffplayProcess = null;
		}
	}
}

function playNextSongCommand() {
	stopMusicCommand();
	playMusic(getRandomSong());
}

function getRandomSong() {
	const arrayOfSongs = vscode.workspace.getConfiguration('musikid').get('localPlaylist');
	const random = arrayOfSongs[Math.floor(Math.random() * arrayOfSongs.length)];
	return random;
}
/**
 * @param {string} music
 */
function playMusic(music) {
	const ytdlpath = vscode.workspace.getConfiguration('musikid').get('youtube-dl-path');
	const ffplayPath = vscode.workspace.getConfiguration('musikid').get('ffplay-path');
	const extraArgs = vscode.workspace.getConfiguration('musikid').get('extraArgs');
	let query = "";

	if (isURL(music)) {
		if (isPlaylist(music)) {
			query = `--yes-playlist ${music}`;
		} else {
			query = `"${music}"`;
		}
	} else {
		query = `ytsearch:"${music}"`
	}

	const youtubedlArgs = [extraArgs, query, `-o`, `-`];
	const ffplayArgs = "-nodisp -autoexit -hide_banner -loglevel panic -i -".split(" ");
	youtubeDLProcess = spawn(ytdlpath, youtubedlArgs, { stdio: ['ignore', 'pipe', 'ignore'] });
	ffplayProcess = spawn(ffplayPath, ffplayArgs, { stdio: ['pipe', process.stdout, process.stderr] });
	youtubeDLProcess.stdout.pipe(ffplayProcess.stdin);
	ffplayProcess.on('close', () => {
		console.log(`ffplay process exited`);
		if (stopMusicFlag) {
			stopMusicCommand();
			stopMusicFlag = false;
		} else {
			playNextSongCommand();
		}
	});
	
	vscode.window.showInformationMessage(`Now playing: ${music}`);
	if (vscode.workspace.getConfiguration('musikid').get('verbose')) {
		console.log(`$ ${ytdlpath} pid: ${youtubeDLProcess.pid} ffplay pid: ${ffplayProcess.pid}}`);
	}

}


/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	console.log(`"Musikid" activated!`);

	let streamMusic = vscode.commands.registerCommand('musikid.streamMusic', function () {
		if (!canPlay) {
			// run precheck
			precheckCommand();
		}

		let randomSong = getRandomSong();

		vscode.window.showInputBox({
			placeHolder: "Song name / URL / Playlist URL",
			prompt: "Enter song name or url",
			value: randomSong
		}).then((user_input) => {
			if (!user_input) {
				return;
			}
			// vscode.commands.executeCommand('stopMusic');
			stopMusicFlag = true;
			stopMusicCommand();
			stopMusicFlag = false;
			playMusic(user_input);
			
		});
	});

	let stopMusic = vscode.commands.registerCommand('musikid.stopMusic', function () {
		stopMusicFlag = true;
		stopMusicCommand();
	});
	
	let nextMusic = vscode.commands.registerCommand('musikid.nextMusic', function () {
		stopMusicCommand();
	});


	context.subscriptions.push(streamMusic);
	context.subscriptions.push(stopMusic);
	context.subscriptions.push(nextMusic);
}



function deactivate() {
	console.log(`"Musikid" deactivated!`);
	stopMusicCommand();
}

module.exports = {
	activate,
	deactivate
}
