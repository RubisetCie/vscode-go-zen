/*---------------------------------------------------------
 * Copyright 2022 The Go Authors. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';

import { CommandFactory } from '.';
import { getGoConfig } from '../config';
import { GoExtensionContext } from '../context';
import { outputChannel, updateLanguageServerIconGoStatusBar } from '../goStatus';
import {
	buildLanguageClient,
	buildLanguageClientOption,
	buildLanguageServerConfig,
	errorKind,
	RestartReason,
	stopLanguageClient,
	suggestGoplsIssueReport,
	toServerInfo,
	updateRestartHistory
} from '../language/goLanguageServer';
import { LegacyLanguageService } from '../language/registerDefaultProviders';
import { Mutex } from '../utils/mutex';

const languageServerStartMutex = new Mutex();

export const startLanguageServer: CommandFactory = (ctx, goCtx) => {
	return async (reason: RestartReason = RestartReason.MANUAL) => {
		const goConfig = getGoConfig();
		const cfg = await buildLanguageServerConfig(goConfig);

		if (typeof reason === 'string') {
			updateRestartHistory(goCtx, reason, cfg.enabled);
		}

		const unlock = await languageServerStartMutex.lock();
		goCtx.latestConfig = cfg;
		try {
			if (reason === RestartReason.MANUAL) {
				await suggestGoplsIssueReport(
					goCtx,
					cfg,
					"Looks like you're about to manually restart the language server.",
					errorKind.manualRestart
				);
			}
			// If the client has already been started, make sure to clear existing
			// diagnostics and stop it.
			if (goCtx.languageClient) {
				await stopLanguageClient(goCtx);
			}
			updateStatus(goCtx, goConfig, false);

			// Before starting the language server, make sure to deregister any
			// currently registered language providers.
			if (goCtx.legacyLanguageService) {
				goCtx.legacyLanguageService.dispose();
				goCtx.legacyLanguageService = undefined;
			}

			if (!shouldActivateLanguageFeatures()) {
				return;
			}

			if (!cfg.enabled) {
				const legacyService = new LegacyLanguageService();
				goCtx.legacyLanguageService = legacyService;
				ctx.subscriptions.push(legacyService);
				updateStatus(goCtx, goConfig, false);
				return;
			}

			goCtx.languageClient = await buildLanguageClient(goCtx, buildLanguageClientOption(goCtx, cfg));
			await goCtx.languageClient.start();
			goCtx.serverInfo = toServerInfo(goCtx.languageClient.initializeResult);

			console.log(`Server: ${JSON.stringify(goCtx.serverInfo, null, 2)}`);
		} catch (e) {
			const msg = `Error starting language server: ${e}`;
			console.log(msg);
			goCtx.serverOutputChannel?.append(msg);
		} finally {
			updateStatus(goCtx, goConfig, true);
			unlock();
		}
	};
};

function updateStatus(goCtx: GoExtensionContext, goConfig: vscode.WorkspaceConfiguration, didStart: boolean) {
	goCtx.languageServerIsRunning = didStart;
	vscode.commands.executeCommand('setContext', 'go.goplsIsRunning', didStart);
	updateLanguageServerIconGoStatusBar(goCtx.languageClient, goConfig['useLanguageServer'] === true);
}

function shouldActivateLanguageFeatures() {
	for (const folder of vscode.workspace.workspaceFolders || []) {
		switch (folder.uri.scheme) {
			case 'vsls':
				outputChannel.error(
					'Language service on the guest side is disabled. ' +
						'The server-side language service will provide the language features.'
				);
				return;
			case 'ssh':
				outputChannel.error('The language server is not supported for SSH. Disabling it.');
				return;
		}
	}
	const schemes = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.scheme);
	if (schemes && schemes.length > 0 && !schemes.includes('file') && !schemes.includes('untitled')) {
		outputChannel.error(
			`None of the folders in this workspace ${schemes.join(
				','
			)} are the types the language server recognizes. Disabling the language features.`
		);
		return;
	}
	return true;
}

export const startGoplsMaintainerInterface: CommandFactory = (ctx, goCtx) => {
	return () => {
		if (!goCtx.languageServerIsRunning) {
			vscode.window.showErrorMessage(
				'"Go: Start language server\'s maintainer interface" command is available only when the language server is running'
			);
			return;
		}
		vscode.commands.executeCommand('gopls.start_debugging', {}).then(undefined, (reason) => {
			vscode.window.showErrorMessage(
				`"Go: Start language server's maintainer interface" command failed: ${reason}`
			);
		});
	};
};
