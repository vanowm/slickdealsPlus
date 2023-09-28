// ==UserScript==
// @name         Slickdeals+
// @namespace    V@no
// @description  Various enhancements
// @match        https://slickdeals.net/*
// @version      23.9.28011831
// @license      MIT
// @run-at       document-start
// @grant        none
// ==/UserScript==

((css, api) =>
{
"use strict";

const linksData = {};
const processedMarker = "©"; //class name indicating that the element has already been processed
// we can use GM_info.script.version but if we use external editor, it shows incorrect version
const VERSION = document.currentScript.textContent.match(/^\/\/ @version\s+(.+)$/m)[1];

/**
 * A function that reads and writes data to the browser's local storage.
 * @function
 * @param {string} id - The ID of the data to read or write.
 * @param {*} [value] - The value to write to the specified ID. If not provided, the function will read the value at the specified ID.
 * @returns void
 */
const SETTINGS = (() =>
{
	const LocalStorageName = "slickdeals+";
	// upgrade from v1.12
	const oldData = localStorage.getItem("linksCache");
	if (oldData)
	{
		localStorage.setItem(LocalStorageName, oldData);
		localStorage.removeItem("linksCache");
	}
	const defaultSettings = {
		freeOnly: { /* show free only */
			default: 0,
			name: "Free Only",
			description: "Only show free items",
		},
		resolveLinks: { /* use resolved links by default*/
			default: 1,
			name: "Resolve links",
			description: "Use resolved links\n* link and page url will be sent to 3nd party service",
			onChange: () => updateLinks()
		},
		noAds: { /* remove ads */
			default: 1,
			name: "No ads",
			description: "Block ads (require page reload)",
		},
		debug: { /* debug mode: 0 = off, 1 = on, 2 = off and hide menu */
			default: 2,
			name: "Debug",
			description: "Show debug messages in the console",
		},
		thumbsUp: { /* highlight deals with this minimum score */
			default: 0,
			type: "number",
			name: "Highlight score ≥",
			description: "Highlight items with minimum of this score",
			min: 0,
			onChange: () => highlightCards(),
		},
		dealDiff: {
			default: 1,
			name: "Price difference",
			description: "Display price/percent difference between current and original prices",
		},
		highlightDiff: { /* highlight deals with this minimum price difference percent */
			default: 0,
			name: "Highlight price diff ≥",
			description: "Highlight items with minimum of this price difference percent",
			type: "number",
			min: 0,
			max: 100,
			onChange: () => highlightCards(),
		},
		version: { /* placeholder */
			default: ""
		}
	};

	const settings = new Map();
	for(const i in defaultSettings)
		settings.set(i, defaultSettings[i].default);

	try
	{
		const data = JSON.parse(localStorage.getItem(LocalStorageName));
		for(const i in data)
			settings.set(i, data[i]);
	}
	catch{}
	/**
	 * Compares two version strings and returns -1, 0, or 1
	 * depending on whether the first version is less than, equal to, or greater than the second version.
	 *
	 * @function
	 * @see {@link https://jsfiddle.net/vanowm/p7uvtbor/ jsFiddle}
	 * @param {string|number} a - The first version string or number to compare.
	 * @param {string|number} b - The second version string or number to compare.
	 * @returns {number} -1 if the first version is less than the second,
	 *                    0 if they are equal, or
	 *                    1 if the first version is greater than the second.
	 */
	const compareVersion = ((prep, length, i, result) =>
		(a, b) =>
		{
			a = prep(a);
			b = prep(b);
			length = Math.max(a.length, b.length);
			i = 0;
			result = i;
			while (!result && i < length)
				result = ~~a[i] - ~~b[i++];

			return result < 0 ? -1 : (result ? 1 : 0);
		})(t => ("" + t)
		.replace(/[^\d.]+/g, c => "." + (c.replace(/[\W_]+/, "").toUpperCase().charCodeAt() - 65_536) + ".")
		.replace(/(?:\.0+)*(\.-\d+(?:\.\d+)?)\.*$/g, "$1")
		.split("."));

	const previousVersion = settings.get("version");
	const updated = !GM_info.isIncognito && previousVersion !== VERSION;
	// eslint-disable-next-line sonarjs/no-collapsible-if
	if (updated && previousVersion)
	{
		//show debug option only if it was manually enabled in previous version
		// eslint-disable-next-line unicorn/no-lonely-if
		if (compareVersion(previousVersion, "1.18.3") < 0)
		{
			settings.debug = settings.debug ? 1 : 2;
		}
		if (compareVersion(previousVersion, "1.15") < 0 && settings.has("resolvedClick"))
		{
			settings.set("resolveLinks", settings.get("resolvedClick"));
		}
	}
	/* clean up old/invalid settings */
	const isLink = /^\d/;
	for(const [id] of settings)
	{
		if (isLink.test(id))
			continue;

		if (!Object.prototype.hasOwnProperty.call(defaultSettings, id))
			settings.delete(id);

		if (typeof settings.get(id) !== typeof defaultSettings[id].default)
			settings.set(id, defaultSettings[id].default);
	}

	settings.set("version", VERSION);
	/**
	 * Initializes the user's settings by adding the appropriate class names to the HTML element.
	 * @function
	 * @returns {void}
	 */
	const settingsInit = () =>
	{
		const elHtml = document.documentElement;
		if (!elHtml)
			return document.addEventListener("DOMContentLoaded", settingsInit);

		for(const i in defaultSettings)
		{
			if (i === "version")
				continue;

			const value = settings.get(i);
			elHtml.classList.toggle(i, !!value);
			// elHtml.dataset[i] = value;
		}

		elHtml.classList.toggle("updated", updated);
		if (!updated || !previousVersion)
			return;

		// notification popup
		const elPopup = document.createElement("div");
		elPopup.textContent = GM_info.script.name + " updated from v" + previousVersion + " to v" + VERSION;
		elPopup.className = "spd-updated";
		const onClick = () =>
		{
			window.removeEventListener("click", onClick, true);
			elPopup.remove();
		};
		window.addEventListener("click", onClick, true);
		if (!document.body)
			return document.addEventListener("DOMContentLoaded", () =>
			{
				document.body.append(elPopup);
			});

		document.body.append(elPopup);
	};
	settingsInit();

	/**
	 * Resets the user's settings to their default values.
	 * @function
	 * @returns {void}
	 */
	const settingsGetData = key => new Proxy(defaultSettings, {
		get: (target, name) => Reflect.get(target[name], key),
		set: () => true, //read-only
	});
	const settingsReset = () =>
	{
		for(const i in defaultSettings)
		{
			if (i !== "version")
				settings.set(i, defaultSettings[i].default);
		}

		settingsSave();
	};
	const defaultKeys = Object.keys(defaultSettings);
	const settingsCommands = {
		$default: settingsGetData("default"),
		$type: settingsGetData("type"),
		$name: settingsGetData("name"),
		$description: settingsGetData("description"),
		$min: settingsGetData("min"),
		$max: settingsGetData("max"),
		$onChange: settingsGetData("onChange"),
		$keys: defaultKeys,
		$reset: () => settingsReset()
	};
	let timer;
	let timeout;

	/**
	 * Saves the data in the cache to the browser's local storage.
	 * @function
	 * @param {number} [attempt=0] - The number of times the function has attempted to save the data.
	 */
	const settingsSave = (attempt = 0) =>
	{
		clearTimeout(timeout);
		const now = Date.now();
		if (timer + 300 > now)
		{
			timeout = setTimeout(() => settingsSave(attempt), 300);
			return;
		}
		try
		{
			// try save settings, if it fails, remove previous items until it succeeds
			localStorage.setItem(LocalStorageName, JSON.stringify(Object.fromEntries(settings)));
		}
		catch
		{
			//removing in batches exponentially
			for(let i = 0, key, keys = settings.keys(), count = ++attempt ** 2; i < count; i++)
			{
				do
				{
					key = keys.next().value;
				}
				while(key && !isLink.test(key)); //don't remove settings

				settings.delete(key);
			}

			if (attempt < 10_000)
				return settingsSave(attempt);

		}
		timer = now;
	};

	if (updated)
		settingsSave();

	/**
	 * Gets or sets a user setting and updates the HTML element accordingly.
	 * @function
	 * @param {string} id - The ID of the setting to get or set.
	 * @param {*} [value] - The value to set the setting to. If omitted, the current value of the setting is returned.
	 * @returns {*} The current value of the setting, or undefined if setting a new value.
	 */
	const settingsFunction = (id, value) =>
	{
		if (value === undefined)
			return settings.get(id);

		settings.set(id, value);
		if (defaultSettings[id] && defaultSettings[id].onChange instanceof Function)
			defaultSettings[id].onChange(value);

		document.documentElement.classList.toggle(id, !!value);
		settingsSave();
	};
	return new Proxy((id, value) => settingsFunction(id, value),
		{
			get: (target, id) =>
			{
				if (Object.prototype.hasOwnProperty.call(settingsCommands, id))
					return settingsCommands[id];

				return target(id);

			},
			set: (target, id, value) => target(id, value)
		});
})();

/**
 * Logs debug information to the console if debug mode is enabled.
 * @function
 * @param {...*} args - The arguments to log to the console.
 */
const debug = Object.assign(SETTINGS.debug === 1 ? console.log.bind(console) : () => {}, {trace: console.trace.bind(console)});

/*------------[ ad blocking ]------------*/
/**
 * Removes ads from the DOM.
 * @function
 * @param {HTMLElement} parent - The HTML element to check for ads.
 * @returns {void}
 */
const noAds = (() =>
{
	const isNoAds = SETTINGS.noAds;
	const setAttributeProperty = Object.getOwnPropertyDescriptor(Element.prototype, "setAttribute");
	Object.defineProperty(Element.prototype, "setAttribute", Object.assign(Object.assign({}, setAttributeProperty), {
		value: function (name, value)
		{
			if (isNoAds && (name === "src" && (this instanceof HTMLScriptElement
											|| this instanceof HTMLIFrameElement
											|| this instanceof HTMLImageElement))
						|| (name === "href" && this instanceof HTMLLinkElement))
			{
				const blocked = isNoAds ? isAds(value) : false;

				if (blocked)
				{
					debug("%cSlickdeals+ " + (blocked ? "blocked" : "allowed") + "%c " + name,
						colors[~~blocked],
						colors[(this.tagName.toLowerCase() || "") + name],
						value,
						isAds.result,
						this);

					this.remove();
					return;
				}
			}
			setAttributeProperty.value.call(this, name, value);
			if (name !== "href" || !(this instanceof HTMLAnchorElement))
				return;

			if (this._hrefResolved && this.href !== this._hrefResolved && this.href !== this._hrefOrig)
				linkUpdate(this, this.href, true);
			else if (SETTINGS.resolveLinks && !this.classList.contains("overlayUrl"))
				processLinks([this], true);
		},
	}));

	if (!isNoAds)
		return () => {};

	const fetch = window.fetch;
	const open = XMLHttpRequest.prototype.open;

	/**
	 * Overrides the `fetch` method to intercept requests and block ads if necessary.
	 */
	window.fetch = function (...args)
	{
		const blocked = isNoAds ? isAds(args[0]) : false;
		if (blocked)
		{
			debug("%cSlickdeals+ " + (blocked ? "blocked" : "allowed") + "%c fetch",
				colors[~~blocked],
				colors.fetch,
				args,
				isAds.result
			);

			return Promise.resolve(new Response("", {status: 403, statusText: "Blocked"}));
		}
		return Reflect.apply(fetch, this, args);
	};

	/**
	 * Overrides the `open` method of `XMLHttpRequest` to intercept requests and block ads if necessary.
	 */
	XMLHttpRequest.prototype.open = function (...args)
	{
		const blocked = isNoAds ? isAds(args[1]) : false;
		if (blocked)
		{
			debug("%cSlickdeals+ " + (blocked ? "blocked" : "allowed") + "%c XHR",
				colors[~~blocked],
				colors.xhr,
				args,
				isAds.result
			);

			this.send = this.abort;
		}
		Reflect.apply(open, this, args);
	};

	/**
	 * Overrides the specified properties of a prototype to intercept requests and block ads if necessary.
	 * @function
	 * @param {Object} prototype - The prototype to override.
	 * @param {(string|string[])} aName - The name(s) of the property to override.
	 */
	const setProperty = (prototype, aName) =>
	{
		if (!Array.isArray(aName))
			aName = [aName];

		for (let i = 0; i < aName.length; i++)
		{
			const name = aName[i];
			const property = Object.getOwnPropertyDescriptor(prototype, name);

			Object.defineProperty(prototype, name, {
				get ()
				{
					return property.get.call(this);
				},
				set (value)
				{
					const _isNoAds = isNoAds && !this.closest(".dealCard");
					const isSource = name === "src";
					const blocked = _isNoAds ? isAds(isSource ? value : undefined, isSource ? undefined : value) : false;
					if (blocked)
					{
						debug("%cSlickdeals+ " + (blocked ? "blocked" : "allowed") + " %c" + (isSource ? this.tagName.toLowerCase() + " " : "") + name,
							colors[~~blocked],
							colors[(name === "src" ? this.tagName.toLowerCase() : "") + name],
							value,
							isAds.result,
							this
						);

						return;
					}
					property.set.call(this, value);
					// // console.log(this, name, this.href);
					// if (name !== "href" || !(this instanceof HTMLAnchorElement))
					// 	return;

					// if (this._hrefResolved && this.href !== this._hrefResolved && this.href !== this._hrefOrig)
					// 	linkUpdate(this, this.href, true);
					// else if (SETTINGS.resolveLinks && !this.classList.contains("overlayUrl"))
					// 	processLinks([this], true);
				},
				enumerable: property.enumerable || true,
				configurable: property.configurable || true
			});
		}
	};

	/**
	 * Returns a function that intercepts requests and blocks ads if necessary.
	 * @function
	 * @param {string} name - The name of the function.
	 * @param {Function} _function - The function to intercept.
	 * @returns {Function} The intercepted function.
	 */
	const getPrototypeFunction = (name, _function) => function (...args)
	{
		if (isNoAds && (args[0] instanceof HTMLImageElement
						|| args[0] instanceof HTMLScriptElement
						|| args[0] instanceof HTMLIFrameElement
						|| args[0] instanceof HTMLLinkElement))
		{
			for(let i = 0; i < args.length; i++)
			{
				const node = args[i];
				if (!node)// || (i && node instanceof HTMLHeadElement))
					continue;

				const blocked = isAds(node.src || node.href, node.innerHTML);

				if (blocked)
				{
					debug("%cSlickdeals+ " + (blocked ? "blocked" : "allowed") + "%c DOM_" + name,
						colors[~~blocked],
						colors.dom,
						node,
						this,
						isAds.result
					);
					node.remove();
					args.splice(i--, 1);
				}
			}
		}
		try
		{
			return Reflect.apply(_function, this, args);
		}
		catch{}
	};

	/**
	 * Overrides the specified methods of a prototype to intercept requests and block ads if necessary.
	 * @function
	 * @param {Object} prototype - The prototype to override.
	 * @param {Object} names - An object containing the names of the methods to override.
	 */
	const setPrototype = (prototype, names) =>
	{
		for (let i = 0; i < names.length; i++)
		{
			const name = names[i];
			const property = Object.getOwnPropertyDescriptor(prototype, name);
			Object.defineProperty(prototype, name, {
				value: getPrototypeFunction(name, prototype[name]),
				enumerable: property.enumerable || true,
				configurable: property.configurable || true
			});
		}
	};
	setProperty(Element.prototype, ["innerHTML", "outerHTML"]);
	setProperty(HTMLScriptElement.prototype, "src");
	setProperty(HTMLIFrameElement.prototype, "src");
	setProperty(HTMLImageElement.prototype, "src");
	setProperty(HTMLLinkElement.prototype, "href");
	setProperty(HTMLAnchorElement.prototype, "href");
	setPrototype(Element.prototype, [
		"append",
		"prepend",
		"after",
		"before",
		"replaceWith",
		"replaceChildren",
		"insertAdjacentElement"
	]);
	setPrototype(Node.prototype, [
		"replaceChild",
		"insertBefore",
		"appendChild"
	]);

	// allow* supersedes block*
	const list = {
		allowUrlFull: new Set([]),

		allowHostname: [
			/:\/\/slickdeals\.net\//
		],
		allowUrl: [
			/google\.com\/recaptcha\//,
			// /accounts\.google\.com\//
		],
		allowText: [
			/vue\.createssrapp/i,
			/frontpagecontroller/i, //Personalized Frontpage
			/^\(window\.vuerangohooks = window\.vuerangohooks/i, //See expired deals
			/SECURITYTOKEN/, //voting
		],

		blockUrlFull: new Set([
			"/ad-stats/1/ad-events",
			"https://v.clarity.ms/collect"
		]),
		blockHostname: [
			/google/,
			/videoplayerhub/i,
			/btttag/,
			/schemaapp\.com/,
		],
		blockUrl: [
			/\/providerv/,
			/\/ad-\//,
			/\.ad\./,
			/\/ads(srvr|\/)/,
			/\.quantcount/,
			/btttag/,
			/connect\.facebook/,
			/heapanalytics/,
			/click\./,
			/adsystem/,
			/bat\.bing/,
			/\.clarity\./,
			/hamburger\./,
			/liadm\.com/,
			/analytic/,
			/adsafe/,
			/pinterest\.com/,
			/s\.pinimg\.com/,
			/s\.yimg\.com/,
			/doubleclick/,
			/google/,
			/clicktrue/
		],
		blockText: [
			/[.:-]ads(loader|[.:-])/i,
			/google\.com/,
			/facebook/,
			/heapanalytics/,
			/demdex/,
			/\.geq/,
			/hydration/,
			/qualtrics/,
			/adsrvr\./,
			/announcementBar/ //top banner
		],
	};

	const colors = {
		0: "color:green", //allowed
		1: "color:red", //blocked
		fetch: "color:cyan",
		xhr: "color:#88f",
		script: "color:orange",
		scriptsrc: "color:orange",
		iframe: "color:#08f",
		iframesrc: "color:#08f",
		imgsrc: "color:#0f8",
		linkhref: "color:#0f8",
		dom: "color:#576",
		innerHTML: "color:#357",
		outerHTML: "color:#056",
		tracker: "color:#656",
	};

	/**
	 * Checks if the given text matches any of the regular expressions in the specified type's list.
	 * @function
	 * @param {string} text - The text to check.
	 * @param {string} type - The type of list to check against.
	 * @returns {boolean} True if the text matches any of the regular expressions in the list, false otherwise.
	 */
	const check = (text, type) =>
	{
		for(let i = 0, regex = list[type]; i < regex.length; i++)
		{
			const match = regex[i].exec(text);
			if (!match)
				continue;

			isAds.result.result = match;
			isAds.result.type = type;
			isAds.result.filter = regex[i];
			return true;
		}
		return false;
	};

	/**
	 * Determines if a URL or text content is an advertisement.
 	 * @function
	 * @param {string} url - The URL to check.
	 * @param {string} textContent - The text content to check.
	 * @returns {boolean} Whether the URL or text content is an advertisement.
	 */
	const isAds = Object.assign((url, textContent) =>
	{
		let hostname = "";
		try
		{
			hostname = url ? new URL(url).hostname : "";
		}
		catch
		{
			try
			{
				hostname = new URL(location.protocol + "//" + location.host + url).hostname;
			}
			catch(error)
			{
				debug.trace(url, error);
			}
		}
		const result = Object.assign(isAds.result, {filter: "", result: "", type: ""});

		if (list.allowUrlFull.has(url))
		{
			result.filter = url;
			result.result = url;
			result.type = "allowUrlFull";
			return false;
		}

		if (list.blockUrlFull.has(url))
		{
			result.filter = url;
			result.result = url;
			result.type = "blockUrlFull";
			return true;
		}

		if (hostname)
		{

			if (check(hostname, "allowHostname"))
				return false;

			if (check(url, "allowUrl"))
				return false;

			if (check(hostname, "blockHostname"))
				return true;

			if (check(url, "blockUrl"))
				return true;
		}
		if (check(textContent, "allowText"))
			return false;

		if (check(textContent, "blockText"))
			return true;

		result.result = "";
		result.filter = "";
		result.type = "";
		return false;
	}, {result: {filter:"", result: "", type: ""}});

	return parent =>
	{
		const nodes = [parent, ...parent.querySelectorAll("script,iframe,link,img")];
		for(let i = 0; i < nodes.length; i++)
		{
			const node = nodes[i];
			isAds.result.result = "";
			isAds.result.filter = "";
			isAds.result.type = "";
			if (node instanceof HTMLIFrameElement)
			{
				if (node.src && isAds(node.src))
				{
					debug("%cSlickdeals+ blocked%c iframe" + (isAds.result.type === "blockText" ? "" : " src"), colors[1], colors.iframe, node.src, isAds.result, node);
					node.remove();
					continue;
				}
				// debug("%cSlickdeals+ allowed%c iframe", colors[0], colors.iframe, node.src, isAds.result, node);
			}
			else if (node instanceof HTMLScriptElement)
			{
				const url = node.src;
				const textContent = node.textContent;
				if (isAds(url, textContent))
				{
					debug("%cSlickdeals+ blocked%c script" + (isAds.result.type === "blockText" ? "" : " src"), colors[1], colors.script, url, textContent, isAds.result);
					node.remove();
					continue;
				}
				// debug("%cSlickdeals+ allowed%c script", colors[0], colors.script, url, textContent, isAds.result);
			}
			else if ((node instanceof HTMLLinkElement || node instanceof HTMLImageElement) && node.href && isAds(node.href))
			{
				debug("%cSlickdeals+ blocked%c tracker" + (isAds.result.type === "blockText" ? "" : " src"), colors[1], colors.tracker, node.href, isAds.result, node);
				node.remove();
				continue;
			}

			if (!node.matches)
				continue;

			if (node.matches(".ablock,.adunit"))
			{
				if (node.parentElement.matches(".subBoxContent"))
					node.parentElement.parentElement.remove();

				node.parentElement.remove();
			}
			else if (node.matches("[data-role=rightRailBanner],[class*=bannerAd],[class*=Banner],[class*=ad-],[class*=contentAd],[data-adlocation]"))
			{
				node.remove();
			}
		}
	};
})();
noAds(document);
const style = document.createElement("style");
style.innerHTML = css;
if (document.head)
	document.head.append(style);

// if (document.head)
// 	noAds(document.head);

// if (document.body)
// 	noAds(document.body);

/*------------[ end ad blocking ]------------*/

/**
 * MutationObserver callback function that tracks changes in the DOM.
 * @function
 * @param {MutationRecord[]} mutations - An array of MutationRecord objects representing the changes in the DOM.
 */
new MutationObserver(mutations =>
{
	for (let i = 0; i < mutations.length; i++)
	{
		for (let n = 0; n < mutations[i].addedNodes.length; n++)
		{
			const node = mutations[i].addedNodes[n];

			if (!node.classList)
				continue;

			// remove ads
			if (SETTINGS.noAds && !node.closest(".dealCard"))
				noAds(node);

			//have we already processed this node?
			if (node.classList.contains(processedMarker))
				continue;

			// create menu and attach to the header
			if (node.matches(".slickdealsHeader__hamburgerDropdown .slickdealsHeader__linkSection"))
			{
				initMenu(node);
				continue;
			}
			processCards(node);
			processLinks(node);
		}
		// for some reason attached menu is being removed...reattach it back if necessary
		for(let n = 0; n < mutations[i].removedNodes.length; n++)
		{
			if (mutations[i].removedNodes[n] === initMenu.elMenu)
				initMenu.elHeader.append(initMenu.elMenu);

		}
	}
}).observe(document, {
	subtree: true,
	childList: true
});

/**
 * Returns the first element that is a descendant of node that matches selectors.
 * @function
 * @param {string} id - The ID of the element to find.
 * @param {HTMLElement} node - The root node to search for the element.
 * @param {boolean} all - Whether to return all elements that match the selector.
 * @returns {HTMLElement|NodeList} The first element that matches the selector, or a NodeList of all elements that match the selector.
 */
const $$ = (id, node, all) =>
{
	try
	{
		if (!node)
			node = document;

		if (!all && /\w/.test(id[0]))
			return node.getElementById(id);

		if (all)
			return node.querySelectorAll(id);

		return node.querySelector(id);
	}
	catch
	{}
};

/**
 * Converts input into a string and trims whitespace.
 * @function
 * @param {string} t - The string to trim.
 * @returns {string} The trimmed string.
 */
const trim = t => ("" + t).trim();

/**
 * Divides a price by a specified divider and formats it as a string with a dollar sign and two decimal places.
 * @function
 * @param {string} _text - The text to prepend to the formatted price.
 * @param {string} divider - The value to divide the price by.
 * @param {string} price - The price to divide and format.
 * @returns {string} The formatted price with the specified text prepended to it.
 */
const priceDivide = (_text, divider, price) => "$" + (Number.parseFloat(price.replace(/,/g, "") / Number.parseFloat(divider))).toFixed(2);

/**
 * Extracts pricing information from a given node and its children.
 * @function
 * @param {HTMLElement|NodeList} node - The root node or NodeList to search for pricing information.
 * @param {boolean} [force=false] - Whether to force processing of already processed items.
 * @returns void
 */
const processCards = (node, force) =>
{
	const processed = force ? "" : ":not(." + processedMarker + ")";
	const nlItems = node instanceof NodeList
		? node
		: $$(	`.salePrice${processed},` +
				`.itemPrice${processed},` +
				`.price${processed},` + //search
				`.bp-p-dealCard_price${processed},` + // https://slickdeals.net/deals/watches/
				`.dealCard__price${processed},` +
				`.dealDetailsMainDesktopBlock__finalPrice${processed},` +
				`.dealPrice${processed}`
		, node, true) || [];

	if (nlItems.length === 0)
		return;

	const priceRegex = /^[\s\w]*~?\$/;
	const priceRegexFrom = /^(?:from\s)?(\d+)\sfor\s\$?([\d,.]+)/g;
	const priceRegexCommas = /,/g;
	const priceRegexTrim = /[\s\w]*~?\$([\d,.]+)(?:\s.*)?/;
	const priceRegexFree = /free/;
	const priceRegexPrice = /^[\s\w]*~?\$([\d,.]+)/;
	const priceRegexOff = /(?:\$?([\d,.]+))?\soff(?:\s\$?([\d,.]+))?$/;
	for (let i = 0; i < nlItems.length; i++)
	{
		const elPrice = nlItems[i];
		elPrice.title = elPrice.textContent;
		let elParent = elPrice.parentNode;
		const price = trim(elPrice.textContent).toLowerCase();
		let priceNew = Number.NaN;
		if (price)
		{
			if ((price === "free"))
				priceNew = 0;
			else if (priceRegex.test(price))
			{
				priceNew = Number.parseFloat(price
					.replace(priceRegexFrom, priceDivide) // 2 for $10
					.replace(priceRegexTrim, "$1") // remove everything after first number ($xx off $yy)
					.replace(priceRegexCommas, "")); // remove commas
			}

		}
		const elPriceRetail = $$(".retailPrice", elParent);
		const elPriceOld = $$(".oldListPrice, .dealCard__originalPrice, .bp-p-dealCard_originalPrice, .dealDetailsMainDesktopBlock__listPrice", elParent);
		// make sure price element is in it's own wrapper
		if (elParent.matches(".bp-c-card_content, .dealDetailsPriceInfo"))
		{
			const elWrapper = document.createElement("div");
			elWrapper.className = "cardPriceInfo";
			elWrapper.append(elPrice);
			if (elPriceOld)
				elWrapper.append(elPriceOld);

			if (elPriceRetail)
				elWrapper.append(elPriceRetail);

			elParent.prepend(elWrapper);
			elParent = elWrapper;
		}
		const priceRetail = Number.parseFloat(trim((elPriceRetail || {}).textContent)
			.replace(priceRegexPrice, "$1")
			.replace(priceRegexCommas, ""));

		const priceOld = Number.parseFloat(trim((elPriceOld || {}).textContent)
			.replace(priceRegexPrice, "$1")
			.replace(priceRegexCommas, ""));

		const off = price.match(priceRegexOff);
		const priceOrig = Number.parseFloat(off && off[2]);
		const priceBase = priceRetail || priceOld || priceOrig;
		if (priceBase && off)
			priceNew = priceBase - priceNew;

		const priceFree = price && price.match(priceRegexFree) || priceNew === 0;
		const priceDifference = priceBase - priceNew;
		const priceDealPercent = Math.round(priceDifference * 100 / priceBase);
		const elCard = elParent.closest(
			"li," +
			"div[data-type='fpdeal']," +
			"div.resultRow," +
			"div[data-role='frontpageDealContent']"
		);

		if (!Number.isNaN(priceDealPercent))
		{
			const diff = priceDifference.toFixed(2).replace(/\.00$/, "");
			elParent.dataset.dealDiff = diff;
			elParent.dataset.dealPercent = priceDealPercent;
			if (elCard)
			{
				elCard.dataset.dealDiff = diff;
				elCard.dataset.dealPercent = priceDealPercent;
			}
			elParent.title = "Save $" + diff + " (" + priceDealPercent + "%)";
		}
		elPrice.classList.add(processedMarker);

		if (elCard)
		{
			elCard.classList.toggle("free", priceFree);
			highlightCards(elCard);
		}
	}
};

/**
 * Highlights the cards with a certain number of votes.
 * @function
 * @param {NodeList|Element} node - The node or NodeList to search for cards.
 * @returns {void}
 */
const highlightCards = node =>
{
	const nlItems = node instanceof NodeList
		? node
		: (node instanceof Element
			? [node]
			: $$(	"li.frontpageGrid__feedItem," + //front page
					"li.carousel__slide," + // front page carousel
					"li.bp-p-dealCard," + // https://slickdeals.net/deals/watches/
					"div.resultRow" //search result
			, node, true));

	if (nlItems.length === 0)
		return;

	const highlightDiff = SETTINGS.highlightDiff;
	for(let i = 0; i < nlItems.length; i++)
	{
		const elCard = nlItems[i];
		const elVotes = elCard.querySelector(
			".dealCardSocialControls__voteCount," + //front page
			".bp-p-votingThumbsPopup_voteCount," + // https://slickdeals.net/deals/watches/
			".ratingCol.stats>.num," + //search result
			".ratingCol>.ratingNum" //search result
		);
		if (elVotes && elVotes.textContent !== "")
		{
			const votes = Number.parseInt(elVotes.textContent);
			elCard.classList.toggle("thumbsUp", SETTINGS.thumbsUp && votes > 0 && votes >= SETTINGS.thumbsUp);
		}
		if (elCard.dataset.dealPercent)
		{
			const dealPercent = ~~elCard.dataset.dealPercent;
			elCard.classList.toggle("highlightDiff", highlightDiff && dealPercent >= highlightDiff);
		}
	}
};

/**
 * Fixes links on a given node by replacing the href with a new URL based on the deal ID and type.
 * @function
 * @param {HTMLElement|NodeList} node - The root node or NodeList to search for links to fix.
 * @param {boolean} [force=false] - Whether to force processing of already processed links.
 * @returns {void}
 */
const processLinks = (node, force) =>
{
	const processed = force ? "" : ":not(." + processedMarker + ")";
	const nlLinks = node instanceof NodeList || Array.isArray(node) ? node : $$(`a:not([href=""])${processed}:not(.overlayUrl)`, node, true) || [];
	for(let i = 0; i < nlLinks.length; i++)
	{
		const elLink = nlLinks[i];

		if (!elLink.href || (elLink._hrefResolved && !force))
			continue;

		elLink.classList.add(processedMarker);
		const {id, type} = getUrlInfo(elLink.href) || {};
		if (!id)
			continue;

		if (!elLink._hrefOrig)
		{
			elLink._hrefOrig = elLink.href;
			const elHover = document.createElement("a");
			elHover.href = elLink._hrefOrig;
			elHover.classList.add(processedMarker, "overlayUrl", "hidden");
			elHover.title = "Original link";
			elHover.target = elLink.target;
			elLink.append(elHover);
		}
		const u2 = elLink.href.match(/(?:\?|&(?:amp;)?)u2=([^#&]*)/i);
		let url = u2 ? decodeURIComponent(u2[1]) : SETTINGS(id + type);

		const aLinks = linksData[id] || [elLink];
		const isInited = aLinks.resolved !== undefined;
		if (isInited)
		{
			if (!aLinks.includes(elLink))
				aLinks.push(elLink);
		}
		else
		{
			aLinks.resolved = false;
			linksData[id] = aLinks;
		}

		// if (!elLink._hrefResolved)
		// {
		// 	elLink.classList.add("alert");
		// }
		if (url)
		{
			if (Array.isArray(url))
				url = url[0];

			aLinks.resolved = true;
			linkUpdate(elLink, url, force);
			continue;
		}
		if (isInited && !force)
			return;

		elLink.classList.add("notResolved");
		if (!SETTINGS.resolveLinks)
			return;

		/**
		 * Set dataset values to multiple elements at once.
		 *
		 * @type {Proxy}
		 */
		const datasets = new Proxy([document.documentElement.dataset], {
			get: (target, property) => target[0][property],
			set: (target, property, value) =>
			{
				if (target.length === 1 && initMenu.elMenu)
					target.push(initMenu.elMenu.dataset, initMenu.elMenu.querySelector(".slickdealsHeader__navItemText").dataset);

				for(let i = 0; i < target.length; i++)
					target[i][property] = value;

				return true;
			},
			deleteProperty: (target, property) =>
			{
				for(let i = 0; i < target.length; i++)
				{
					if (property in target[i])
						delete target[i][property];
				}

				return true;
			}
		});
		if (datasets.loading === undefined)
			datasets.loading = 0;

		datasets.loading++;

		/**
		 * Resolves a URL
		 * @function
		 * @param {string} id - The ID of the deal to resolve.
		 * @param {string} type - The type of the deal to resolve.
		 * @param {string} url - The URL to resolve.
		 * @returns {Promise<Object>} A Promise that resolves to an object containing the resolved URL and other data.
		 */
		resolveUrl(id, type, elLink._hrefOrig)
			.then(response =>
			{
				if (!response || response instanceof Response || response.byteLength === 0)
					throw new Error("URL not resolved " + (response instanceof Response ? response.headers.get("error") : ""));

				response = new Uint8Array(response);
				const k = new TextEncoder().encode(id + type);
				const r = new Uint8Array(response.length)
					.map((_, i) => response[i] ^ response[i - 1] ^ k[i % k.length]);

				response = new TextDecoder().decode(r.slice(r.indexOf(0) + 1));
				try
				{
					SETTINGS(id + type, response);
					for(let i = 0; i < aLinks.length; i++)
						linkUpdate(aLinks[i], response);

					aLinks.resolved = true;
				}
				catch{}
				return response;
			})
			.finally(() =>
			{
				if (!--datasets.loading)
					delete datasets.loading;

			})
			.catch(console.error);
	}
};

/**
 * Updates a link with a new URL and styling to indicate that it has been resolved.
 * @function
 * @param {HTMLAnchorElement} elA - The link to update.
 * @param {string} url - The new URL to set on the link.
 * @returns {void}
 */
const linkUpdate = (elA, url, update) =>
{
	// elA.classList.remove("alert");
	if (elA._hrefResolved && !update)
		return;

	if (url)
		elA._hrefResolved = url;

	elA.classList.toggle("notResolved", !elA._hrefResolved);
	const elHover = elA.querySelector("a.overlayUrl");
	if (SETTINGS.resolveLinks && elA._hrefResolved)
	{
		if (elHover)
		{
			elHover.title = "Original link";
			elHover.href = elA._hrefOrig;
			elHover.classList.remove("hidden");
		}
		elA.href = elA._hrefResolved;
		elA.classList.add("resolved");
		elA.classList.remove("tracked");
	}
	else
	{
		if (elHover)
		{
			elHover.classList.toggle("hidden", !elA._hrefResolved);
			elHover.title = "Resolved link";
			elHover.href = elA._hrefResolved;
		}
		elA.href = elA._hrefOrig;
		elA.classList.add("tracked");
		elA.classList.remove("resolved");
	}
	// a.title = a._hrefResolved;
};

/**
 * Updates all unresolved links on the page.
 * @function
*/
const updateLinks = () =>
{
	if (SETTINGS.resolveLinks)
	{
		const nlList = $$(".notResolved", document.body, true);
		if (nlList.length > 0)
			processLinks(nlList, true);
	}
	for(const id in linksData)
	{
		const aLinks = linksData[id];
		for(let i = 0; i < aLinks.length; i++)
		{
			linkUpdate(aLinks[i], undefined, true);
		}
	}
};

/**
 * Resolves a given URL by fetching data from the Slickdeals API and updating all links with the same deal ID.
 * @function
 * @param {string} id - The ID of the deal to resolve.
 * @param {string} type - The type of the deal to resolve.
 * @param {string} url - The URL to resolve.
 * @returns {Promise} A Promise that resolves with the data returned from the Slickdeals API.
 */
const resolveUrl = (id, type, url) => fetch(api + VERSION + "/" + id + type, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify([url,location.href]), referrerPolicy: "unsafe-url"})
	.then(r => r && r.ok && r.arrayBuffer() || r)
	.catch(() => {});

/**
 * Extracts the ID and type of a deal from a given URL.
 * @function
 * @param {string} url - The URL to extract the ID and type from.
 * @returns {Object|boolean} An object containing the ID and type of the deal, or false if no ID or type could be found.
 */
const getUrlInfo = (() =>
{
	const ids = ["pno", "tid", "sdtid", "pcoid"].map(id => new RegExp("(?:\\?|&(?:amp;)?)(" + id + ")=([^&]+)", "i"));
	const queryConvert = {
		sdtid : "tid"
	};
	const lnoRegex = /(?:\?|&(?:amp;)?)lno=(\d+)/i;
	return url =>
	{
		let type;
		let id;
		for (let i = 0; i < ids.length; i++)
		{
			[, type, id] = ids[i].exec(url) || [];
			if (id !== undefined)
				break;
		}
		if (type === undefined)
			return false;

		type = queryConvert[type] || type;

		const matchLNO = lnoRegex.exec(url);
		if (matchLNO)
			id += "-" + matchLNO[1];

		return {id, type};
	};
})();

/**
 * Initializes the Slickdeals+ menu.
 * @function
 * @param {HTMLElement} elNav - The navigation element to use as the menu container.
 */
const initMenu = elNav =>
{
	if (elNav.children.length < 4 && --initMenu.counter)
		return setTimeout(() => initMenu(elNav), 0);

	/**
	 * Creates a menu item for a user setting.
	 * @function
	 * @param {string} id - The ID of the setting to create a menu item for.
	 * @returns {Element} The menu item element.
	 */
	const createMenuItem = (id, options = {}) =>
	{
		const type = SETTINGS.$type[id];
		const text = SETTINGS.$name[id];
		const description = SETTINGS.$description[id];
		const elStyle = document.createElement("style");
		const elSetting = document.createElement(type === "number" ? "input" : "a");
		const elLi = elLiDefault.cloneNode(true);
		let elLabelBefore;
		let elLabelAfter;
		if (type === "number")
		{
			//only allow positive round numbers
			elSetting.addEventListener("keypress", evt =>
			{
				if (evt.charCode < 48 || evt.charCode > 57)
				{
					evt.preventDefault();
					evt.stopPropagation();
				}
			});
			elSetting.addEventListener("input", () => SETTINGS(id, ~~elSetting.value));
			elSetting.type = "number";
			elSetting.min = SETTINGS.$min[id] || 0;
			if (SETTINGS.$max[id] !== undefined)
			{
				elSetting.max = SETTINGS.$max[id];
				const length_ = ("" + elSetting.max).length;
				elSetting.style.width = (length_ * 2) + "ch";
			}

			elSetting.step = 1;
			elLabelBefore = document.createElement("span");
			elLabelBefore.textContent = text;
			elLi.classList.add("input");
		}
		else //checkboxes
		{
			elSetting.addEventListener("click", () => SETTINGS(id, ~~!SETTINGS(id)));
			elSetting.addEventListener("keypress", evt =>
			{
				if (evt.key === " " || evt.key === "Enter")
				{
					evt.preventDefault();
					evt.stopPropagation();
					SETTINGS(id, ~~!SETTINGS(id));
				}
			});
			elSetting.textContent = text;
			elStyle.textContent = `html.${id} #${id}::before{content:"☑";}`;
			elSetting.classList.add("slickdealsHeaderDropdownItem__link");
		}
		elSetting.value = SETTINGS(id);
		elSetting.id = id;
		elSetting.setAttribute("tabindex", 0);
		elSetting.dataset[dataset] = "";
		elLi.classList.add(id);
		elLi.title = description;

		if (options.labelBefore)
		{
			if (!elLabelBefore)
				elLabelBefore = document.createElement("span");

			elLabelBefore.textContent = options.labelBefore;
		}
		if (elLabelBefore)
			elLi.append(elLabelBefore);

		elLi.append(elSetting);

		if (options.labelAfter)
		{
			if (!elLabelAfter)
				elLabelAfter = document.createElement("span");

			elLabelAfter.textContent = options.labelAfter;
		}
		if (elLabelAfter)
			elLi.append(elLabelAfter);

		document.head.append(elStyle);
		return elLi;
	};
	const elMenu = elNav.lastElementChild.cloneNode(true);
	initMenu.elMenu = elMenu;
	initMenu.elHeader = elNav;
	const elHeader = elNav.closest("header");
	const elOverlay = document.createElement("div");
	initMenu.elOverlay = elOverlay;
	for (const i in elMenu.dataset)
	{
		if (/^v-\d/.test(i))
			elOverlay.dataset[i] = elMenu.dataset[i];
	}
	initMenu.elOverlay.className = "slickdealsHeader__overlay";

	elMenu.classList.add("sdp-menu");
	elMenu.dataset.qaHeaderDropdownButton = "slickdeals-plus";
	elMenu.querySelector("p").textContent = "Slickdeals+";
	const elUl = elMenu.querySelector("ul");
	const elButton = elMenu.querySelector("div[role='button']");

	elButton.addEventListener("focus", () => elHeader.after(elOverlay), true);
	elButton.addEventListener("blur", () => elOverlay.remove(), true);
	elMenu.addEventListener("mousedown", evt =>
	{
		const isMenu = evt.target === elButton || evt.target.parentElement === elButton;
		const isMenuOpen = (document.activeElement.closest(".sdp-menu > div[role='button']") || {}) === elButton;

		if (isMenu && isMenuOpen)
		{
			evt.preventDefault();
			evt.stopPropagation();
			elOverlay.click();
		}
	});
	elOverlay.addEventListener("click", () =>
	{
		elButton.focus();
		elButton.blur();
		elOverlay.remove();
	});
	const loading = document.documentElement.dataset.loading;

	elUl.dataset.qaHeaderDropdownList = "slickdeals-plus";
	const elLiDefault = elUl.querySelector("li").cloneNode(true);
	const dataset = Object.keys(elLiDefault.firstElementChild.dataset)[0];
	elUl.innerHTML = "";
	elLiDefault.innerHTML = "";
	elNav.append(elMenu);

	elUl.append(createMenuItem("freeOnly"));
	const elMenuItem = createMenuItem("resolveLinks");
	if (loading)
	{
		elMenu.dataset.loading = loading;
		elMenuItem.dataset.loading = loading;
	}
	elUl.append(elMenuItem);
	elUl.append(createMenuItem("dealDiff"));
	elUl.append(createMenuItem("highlightDiff", {
		labelAfter: "%"
	}));
	elUl.append(createMenuItem("thumbsUp"));
	elUl.append(createMenuItem("noAds"));
	if (SETTINGS.debug < 2)
		elUl.append(createMenuItem("debug"));
	const elFooter = document.createElement("div");
	elFooter.className = "slickdealsHeaderDropdownItem footer";
	elFooter.textContent = "v" + VERSION;
	elFooter.dataset[dataset] = "";
	elUl.append(elFooter);
};
initMenu.counter = 1000;

/**
 * The main function that initializes the Slickdeals+ script.
 * @function
 * @returns {void}
 */
const init = () =>
{
	document.removeEventListener("DOMContentLoaded", init, false);

	const isDarkMode = document.body.matches("[class*=darkMode]"); //bp-s-darkMode

	document.body.classList.toggle("darkMode", isDarkMode);
	const cssFindIdRegex = /^v([A-F]|-\d)/;
	const cssFindId = cssFindIdRegex.test.bind(cssFindIdRegex);
	style.innerHTML = css.replace(/^(.*)\[data-v-ID]/gm, (txt, query) =>
	{
		const element = document.body.querySelector(query);
		if (element)
		{
			const keys = Object.keys(element.dataset);
			const id = keys.find(cssFindId);
			if (id)
				return query + "[data-" + id.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase() + "]";
		}
		return query;
	});
	document.head.append(style);

	//for some reason observer failed to process everything while page is still loading, so we do it manually
	const elPageContent = $$("pageContent");
	if (elPageContent)
	{
		processCards(elPageContent);
		processLinks(elPageContent);
	}
	debug(GM_info.script.name, "v" + VERSION, "initialized");
};//init()

document.addEventListener("DOMContentLoaded", init, false);
// eslint-disable-next-line quotes
})(`a.resolved:not(.seeDealButton):not(.button.success):not(.dealDetailsOutclickButton)
{
	color: #00b309;
}
body.bp-s-darkMode .dealDetailsOutclickButton[data-v-ID].resolved,
.dealDetailsOutclickButton[data-v-ID].resolved,
.seeDealButton.resolved
{
	--buttonBackgroundColor: #0c9144;
	--dealDetailsOutclickButtonBgColor: #0c9144;
	--dealDetailsOutclickButtonBgColorHover: #0b7b1d;
	--dealDetailsOutclickButtonBgColorActive: #06551a;
}
.seeDealButton.resolved:hover
{
	--buttonBackgroundColor: #0b7b1d;
}
.seeDealButton.resolved:active
{
	--buttonBackgroundColor: #06551a;
}

li.free .dealCard[data-v-ID],
div.free,
li.free
{
	--highlightColor: #FF5D6A;
	--backgroundColor: #ffdde0;
}

body.darkMode li.free .dealCard[data-v-ID],
body.darkMode div.free,
body.darkMode li.free
{
	--highlightColor: #A11E1C;
	--backgroundColor: #443534;
	--cardBackgroundColor: var(--backgroundColor);
}


li.thumbsUp .dealCard[data-v-ID],
div.thumbsUp,
li.thumbsUp
{
	--backgroundColor: #E4FFDD;
	--cardBackgroundColor: var(--backgroundColor);
}

body.darkMode li.thumbsUp .dealCard[data-v-ID],
body.darkMode div.thumbsUp,
body.darkMode li.thumbsUp
{
	--backgroundColor: #222C21;
	--cardBackgroundColor: var(--backgroundColor);
}

li.highlightDiff .dealCard[data-v-ID],
div.highlightDiff,
li.highlightDiff
{
	--backgroundColor: #ffecdd;
	--cardBackgroundColor: var(--backgroundColor);
}
body.darkMode li.highlightDiff .dealCard[data-v-ID],
body.darkMode div.highlightDiff,
body.darkMode li.highlightDiff
{
	--backgroundColor: #321c38;
	--cardBackgroundColor: var(--backgroundColor);
}
/* search results */
.resultRow.free,
.resultRow.highlightDiff,
.resultRow.thumbsUp
{
	background-color: var(--backgroundColor);
}

.resultRow.free
{
	position: relative; /* allow box-shadow overlap item below */
}
/* end search results */

div.free,
li.free,
div.thumbsUp,
li.thumbsUp,
div.highlightDiff,
li.highlightDiff
{
	animation: pulse .5s infinite alternate;
}
@keyframes pulse
{
	from { box-shadow: 0 0 1em var(--highlightColor);}
	to {box-shadow: 0 0 0.5em var(--highlightColor);}
}

#fpMainContent .gridCategory .fpGridBox.list.free,
#fpMainContent .gridCategory .fpGridBox.simple.free
{
	margin: 0.5em;
}

#fpMainContent .gridCategory .grid .fpItem .itemInfoLine .avatarBox,
#fpMainContent .gridCategory ul.gridDeals .fpGridBox .itemInfoLine .avatarBox,
#fpMainContent .gridCategory .grid .fpItem.isPersonalizedDeal .itemBottomRow .comments
{
	display: initial !important;
}

#fpMainContent .gridCategory ul.gridDeals .fpGridBox .itemInfoLine .avatarBox
{
	float: right;
	position: initial;
}

#fpMainContent .gridCategory ul.gridDeals .fpGridBox .fpItem .itemBottomRow .comments
{
	display: initial !important;
	position: absolute;
	right: -2.5em;
	bottom: 5em;
}

a.overlayUrl
{
	position: relative;
	height: 1em;
	display: none;
}

a.overlayUrl::before,
a.overlayUrl::after
{
	content: "";
	position: absolute;
	height: 1.3em;
	top: -0.1em;

}

a.overlayUrl::after
{
	width: 2.2em;
}

a.overlayUrl::before
{
	width: 1.3em;
	border-radius: 0.5em;
	background-color: #ffffff9f;
	background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9ImN1cnJlbnRDb2xvciIgcHJlc2VydmVBc3BlY3RSYXRpbz0ieE1pbllNaW4gbWVldCIgdmlld0JveD0iMCAwIDEwIDExIj4KICA8cGF0aCBmaWxsPSJpbmhlcml0IiBkPSJtOC40NjUuNTQ2Ljk5Ljk5YTEuODcgMS44NyAwIDAgMS0uMDAyIDIuNjRsLTEuMzIgMS4zMmExLjQxMiAxLjQxMiAwIDAgMS0xLjUyNS4zMDMuNDY3LjQ2NyAwIDAgMSAuMzU3LS44NjJjLjE3NC4wNy4zNzQuMDMuNTA5LS4xMDJsMS4zMjEtMS4zMTdhLjkzMy45MzMgMCAwIDAgMC0xLjMybC0uOTktLjk5YS45MzMuOTMzIDAgMCAwLTEuMzIgMGwtMS4zMiAxLjMyYS40NjcuNDY3IDAgMCAwLS4xLjUwNi40NjcuNDY3IDAgMSAxLS44NjMuMzU3IDEuNDAzIDEuNDAzIDAgMCAxIC4zMDMtMS41MjZsMS4zMi0xLjMyYTEuODcgMS44NyAwIDAgMSAyLjY0IDBaIi8+CiAgPHBhdGggZmlsbD0iaW5oZXJpdCIgZD0iTTMuMDIgNi45OGEuNDcuNDcgMCAwIDAgLjY2IDBsMy42My0zLjYzYS40NjcuNDY3IDAgMCAwLS42Ni0uNjZMMy4wMiA2LjMyYS40NjcuNDY3IDAgMCAwIDAgLjY2WiIvPgogIDxwYXRoIGZpbGw9ImluaGVyaXQiIGQ9Ik01LjE5IDYuMzU3YS40NjcuNDY3IDAgMCAwLS4yNTMuNjEuNDY3LjQ2NyAwIDAgMS0uMTAyLjUwOGwtMS4zMiAxLjMyYS45MzMuOTMzIDAgMCAxLTEuMzIgMGwtLjk5LS45OWEuOTMzLjkzMyAwIDAgMSAwLTEuMzJsMS4zMjItMS4zMmEuNDczLjQ3MyAwIDAgMSAuNTEtLjEuNDY3LjQ2NyAwIDAgMCAuMzU1LS44NjQgMS40MTYgMS40MTYgMCAwIDAtMS41MjUuMzA1TC41NDYgNS44MjZhMS44NyAxLjg3IDAgMCAwIDAgMi42NGwuOTkuOTljLjcyOS43MjggMS45MS43MjggMi42NCAwbDEuMzItMS4zMmMuNC0uNDAxLjUyLTEuMDAzLjMwMy0xLjUyN2EuNDY3LjQ2NyAwIDAgMC0uNjEtLjI1MloiLz4KPC9zdmc+");
	background-position: center;
	background-repeat: no-repeat;
	padding: 0.5em 1em;
	left: .1em;
	opacity: 0.5;
}

a.overlayUrl:hover::before
{
	background-color: #ffffff;
	opacity: 1;
}

a:hover > a.overlayUrl
{
	display: inline;
}

.bp-p-adBlock,
.hidden
{
	display: none !important;
}

html.freeOnly .frontpageRecommendationCarousel li:not(.free),
html.freeOnly .dealTiles li:not(.free),
html.freeOnly .bp-p-categoryPage_main li:not(.free), /* https://slickdeals.net/deals/*** */
html.freeOnly .frontpageGrid li:not(.free)
{
	display: none;
}

/* setting checkbox */

.sdp-menu .slickdealsHeaderDropdownItem
{
	cursor: pointer;
	color: var(--hamburgerTextColor);
}

.sdp-menu .slickdealsHeaderDropdownItem__link[data-v-ID]
{
	column-gap: 4px;
}
.sdp-menu .slickdealsHeaderDropdownItem > a::before
{
	content: "☐";
	display: inline-block;
	width: 1em;
	height: 1em;
	line-height: 1em;
	font-size: 1.3em;
	margin: 0 0.1em;
}

/* end setting checkbox */

/* setting input */


.sdp-menu ul[data-v-ID],
.sdp-menu .slickdealsHeaderDropdownItem.input,
.sdp-menu .footer
{
	cursor: default;
	row-gap: 0;
}

.sdp-menu li
{
	white-space: nowrap;
}

.sdp-menu .footer
{
	text-align: right;
	opacity: 0.5;
}
.sdp-menu ul[data-v-ID] .slickdealsHeaderDropdownItem.input
{
	padding: 0.35em 0.8em;
}
.sdp-menu li > input
{
	border: 1px solid;
	border-radius: 3px;
	padding: revert;
	margin: revert;
	width: 5em;
	height: 2em;
	line-height: 2em;
	display: inline-block;
	color: inherit;
	background-color: inherit;
}

.sdp-menu li > span:first-child
{
	margin-right: 0.6em;
}
.sdp-menu li > span:last-child
{
	margin-left: 0.6em;
}

/* end setting input */

:root[data-loading] .sdp-menu::before,
:root[data-loading] .sdp-menu::after,
:root[data-loading] .sdp-menu .slickdealsHeader__navItemText::before,
:root[data-loading] .sdp-menu .slickdealsHeader__navItemText::after
{
	position: absolute;
	z-index: 1;
	pointer-events: none;
}

/* update popup */
html.updated .spd-updated
{
	background-color: darkred;
	width: 100%;
	height: 1.5rem;
	top: 0;
	left: 0;
	z-index: 9999;
	position: fixed;
	text-align: center;
	line-height: 1.5rem;
	font-size: 1rem;
	color: white;
	animation: shrink 60s ease 600s forwards;
}

@keyframes shrink {
	90% {
		font-size: 0.5rem;
		opacity: 1;
	}
	100%
	{
		font-size: 0;
		opacity: 0;
		display: none;
	}
}
/* end update popup */

@media (min-width: 1024px)
{
	:root[data-loading] .sdp-menu
	{
		position: relative;
	}
	:root[data-loading] .sdp-menu::before
	{
		content: "⌛";
		right: 0.1em;
		line-height: 2.5em;
		animation: spin 1s linear infinite;
	}
	:root[data-loading] .sdp-menu::after
	{
		content: attr(data-loading);
		text-align: center;
		width: 1em;
		line-height: 1em;
		top: 0.8em;
		right: 0.1em;
		color: black;
		text-shadow: 1px 0 0 #fff,
			0 1px 0 #fff,
			-1px 0 0 #fff,
			0 -1px 0 #fff,
			0 0 0 #fff;
	
	}
	.sdp-menu .slickdealsHeaderDropdownItem
	{
		color: var(--dropdownTextColor);
	}
	
}

@media (max-width: 1023px)
{
	:root[data-loading] .sdp-menu .slickdealsHeader__navItemText
	{
		position: relative;
		overflow: unset !important;
	}
	:root[data-loading] .sdp-menu .slickdealsHeader__navItemText::before
	{
		content: "⌛";
		right: -1.5em;
		line-height: 2.0em;
		animation: spin 1s linear infinite;
	}
	:root[data-loading] .sdp-menu .slickdealsHeader__navItemText::after
	{
		content: attr(data-loading);
		text-align: center;
		width: 1em;
		height: 1em;
		line-height: 1em;
		top: 0.5em;
		right: -1.5em;
		color: black;
		text-shadow: 1px 0 0 #fff,
			0 1px 0 #fff,
			-1px 0 0 #fff,
			0 -1px 0 #fff,
			0 0 0 #fff;
	}
}

@keyframes spin {
	100% {
		transform: rotate(360deg);
	}
}

.dealCard__priceContainer[data-v-ID]
{
	display: flex;
	overflow: hidden;
	flex-wrap: wrap;
	height: min-content;
}
.dealCard__priceContainer > span:last-of-type
{
	margin-right: 4px;
}

.dealDetailsPriceInfo[data-deal-diff]
{
	position: relative;
}

.cardPriceInfo /* added price wrapper for https://slickdeals.net/deals/*** */ 
{
	grid-area: price;
	display: inline-flex;
	flex-wrap: wrap;
	align-items: center;
	gap: inherit;
}

html.dealDiff .dealDetailsMainDesktopBlock__priceBlock[data-deal-diff]::after, /* deal details page */
html.dealDiff .dealDetailsPriceInfo[data-deal-diff]::after, /* deal details page */
html.dealDiff .cardPriceInfo[data-deal-diff]::after, /* https://slickdeals.net/deals/* */
html.dealDiff .priceCol > .prices[data-deal-diff]::after, /* search result */
html.dealDiff a[data-deal-diff]::after /* deal list page */
{
	content: "($" attr(data-deal-diff) " | " attr(data-deal-percent) "%)";
	font-style: italic;
	width: 100%; /* force on new line */
}

@media (min-width: 768px) {
	.dealCard__content[data-v-ID] {
		grid-template-rows:auto 67px auto 1fr 20px;
	}
}
.pageContent--reserveAnnouncementBar { /* top banner */
	padding-top: 0 !important;
}`/* eslint-disable-next-line unicorn/no-array-reduce,arrow-spacing,unicorn/no-array-for-each,space-infix-ops,unicorn/prefer-number-properties, indent*/,
"szdcogvyz19rw0xl5vtspkrlu39xtas5e6pir17qjyux7mlr".match(/.{1,6}/g).reduce((Х,Χ)=>([24,16,8,0].forEach(X=>Х+=String.fromCharCode(parseInt(Χ,36)>>X&255)),Х),""));