// ==UserScript==
// @name         Slickdeals+
// @namespace    V@no
// @description  Various enhancements
// @match        https://slickdeals.net/*
// @version      1.17
// @license      MIT
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function (css, api)
{
"use strict";
if (window.top !== window.self)
	return;

const linksData = {};
const processedMarker = "sdp"; //class name indicating that the element has already been processed
/*------------[ ad blocking ]------------*/
/**
 * Removes ads from the DOM.
 * @param {HTMLElement} parent - The HTML element to check for ads.
 * @returns {void}
 */
const noAds = (function ()
{
	const fetch = window.fetch;
	const open = XMLHttpRequest.prototype.open;

	/**
	 * Overrides the `fetch` method to intercept requests and block ads if necessary.
	 */
	window.fetch = function (...args)
	{
		const blocked = SETTINGS.noAds ? isAds(args[0]) : false;
		if (SETTINGS.noAds)
		{
			debug("Slickdeals+%c fetch %c" + (blocked ? "blocked" : "allowed"), colors.fetch, colors[~~blocked], args, isAds.result);

			if (blocked)
				return new Promise((resolve, reject) => reject()).catch(() => {});
		}
		return Reflect.apply(fetch, this, args);
	};

	/**
	 * Overrides the `open` method of `XMLHttpRequest` to intercept requests and block ads if necessary.
	 */
	XMLHttpRequest.prototype.open = function (...args)
	{
		const blocked = SETTINGS.noAds ? isAds(args[1]) : false;
		if (SETTINGS.noAds)
		{
			debug("Slickdeals+%c XHR%c " + (blocked ? "blocked" : "allowed"), colors.xhr, colors[~~blocked], args, isAds.result);

			if (blocked)
				this.send = this.abort;
		}
		Reflect.apply(open, this, args);
	};

	/**
	 * Overrides the specified properties of a prototype to intercept requests and block ads if necessary.
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
					const isNoAds = SETTINGS.noAds;
					const blocked = isNoAds ? isAds(name === "src" ? value : undefined, name === "src" ? undefined : value) : false;
					if (isNoAds)
					{
						debug("Slickdeals+%c " + name + "%c " + (blocked ? "blocked" : "allowed"), colors[(name === "src" ? this.tagName.toLowerCase() : "") + name], colors[~~blocked], value, isAds.result, this);
						if (blocked)
							return;
					}
					property.set.call(this, value);
				},
				enumerable: property.enumerable || true,
				configurable: property.configurable || true
			});
		}
	};

	/**
	 * Overrides the specified methods of a prototype to intercept requests and block ads if necessary.
	 * @param {Object} prototype - The prototype to override.
	 * @param {Object} names - An object containing the names of the methods to override.
	 */
	const setPrototype = (prototype, names) =>
	{
		for (const name in names)
		{
			const _function = prototype[name];
			prototype[name] = function (...args)
			{
				const isNoAds = SETTINGS.noAds;
				for(let i = 0; i < args.length; i++)
				{
					if (!args[i] || (i && args[i] instanceof HTMLHeadElement))
						continue;

					const blocked = isNoAds ? isAds(args[i].src, args[i].innerHTML) : false;
					if (isNoAds)
					{
						debug("Slickdeals+%c DOM_" + name + "%c " + (blocked ? "blocked" : "allowed"), colors.dom, colors[~~blocked], args[i], this, isAds.result);

						if (blocked)
						{
							// args[i].innerHTML = "";
							args[i].remove();
							args.splice(i--, 1);
							continue;
						}
					}
				}
				try
				{
					return Reflect.apply(_function, this, args);
				}
				catch{}
			};
		}
	};
	setProperty(Element.prototype, ["innerHTML", "outerHTML"]);
	setProperty(HTMLElement.prototype, ["innerText", "outerText"]);
	setProperty(Node.prototype, "textContent");
	setProperty(HTMLScriptElement.prototype, "src");
	setProperty(HTMLIFrameElement.prototype, "src");
	setPrototype(Element.prototype, ["append", "prepend", "after", "before", "replaceWith", "insertBefore", "replaceChild", "appendChild", "prependChild", "insertAdjacentElement"]);
	const property = Object.getOwnPropertyDescriptor(Element.prototype, "setAttribute");
	Object.defineProperty(Element.prototype, "setAttribute", Object.assign(Object.assign({}, property), {
		value: function (name, value)
		{
			const isNoAds = SETTINGS.noAds;
			if (isNoAds && (this instanceof HTMLScriptElement || this instanceof HTMLIFrameElement) && name === "src")
			{
				const blocked = isNoAds ? isAds(value) : false;
				debug("Slickdeals+%c " + name + "%c " + (blocked ? "blocked" : "allowed"), colors[(this.tagName.toLowerCase() || "") + name], colors[~~blocked], value, isAds.result, this);
				if (blocked)
				{
					this.remove();
					return;
				}
			}
			property.value.call(this, name, value);
			if (!(name === "href" && this instanceof HTMLAnchorElement))
				return;

			if (this._hrefResolved && this.href !== this._hrefResolved && this.href !== this._hrefOrig)
				linkUpdate(this, this.href, true);
			else if (SETTINGS.resolveLinks && !this.classList.contains("overlayUrl"))
				processLinks([this], true);
		},
	}));

	const list = {
		blockUrlFull: new Set([
			"/ad-stats/1/ad-events",
			"https://v.clarity.ms/collect"
		]),
		blockText: [
			/[.:-]ads(loader|[.:-])/i,
			/google/,
			/facebook/,
			/heapanalytics/,
			/demdex/,
			/\.geq/,
			/hydration/,
			/qualtrics/
		],
		blockUrl: [
			/\/providerv/,
			/\/ad-\//,
			/\.ad\./,
			/\/ads(srvr|\/)/,
			/\/pagecount/,
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
			/analytic/
		],
		blockHostname: [
			/google/,
			/videoplayerhub/i,
			/btttag/
		],

		allowUrlFull: new Set([]),

		allowUrl: [
			/google\.com\/recaptcha\//,
			// /accounts\.google\.com\//
		],

		allowHostname: [
			/:\/\/slickdeals\.net\//
		],
		allowText: [
			/vue\.createssrapp/i,
			/frontpagecontroller/i, //Personalized Frontpage
			/^\(window\.vuerangohooks = window\.vuerangohooks/i, //See expired deals
		]
	};
	const colors = {
		0: "color:green",
		1: "color:red",
		fetch: "color:cyan",
		xhr: "color:#88f",
		script: "color:orange",
		scriptsrc: "color:orange",
		iframe: "color:#08f",
		iframesrc: "color:#08f",
		dom: "color:#576",
		innerHTML: "color:#367"
	};

	/**
	 * Checks if the given text matches any of the regular expressions in the specified type's list.
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
		const nodes = [parent, ...parent.querySelectorAll("script,iframe")];
		for(let i = 0; i < nodes.length; i++)
		{
			const node = nodes[i];
			if (node.tagName === "IFRAME")
			{
				if (node.src && isAds(node.src))
				{
					debug("Slickdeals+%c iframe%c blocked", colors.iframe, colors[1], node.src, isAds.result, node);
					node.remove();
					continue;
				}
				debug("Slickdeals+%c iframe%c allowed", colors.iframe, colors[0], node.src, isAds.result, node);
			}
			// https://js.slickdealscdn.com/scripts/bundles/frontpage.js?9214
			if (node.tagName === "SCRIPT")
			{
				const url = node.src;
				const textContent = node.textContent;
				if (isAds(url, textContent))
				{
					debug("Slickdeals+%c script%c blocked", colors.script, colors[1], url, textContent, isAds.result);
					node.remove();
					continue;
				}
				debug("Slickdeals+%c script%c allowed", colors.script, colors[0], url, textContent, isAds.result);
			}
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
/*------------[ end ad blocking ]------------*/

/**
 * Track changes in the DOM
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
			if (SETTINGS.noAds)
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
			// processLinks(node);
		}
		// for some reason attached menu is being removed...reattach it back if necessary
		for(let n = 0; n < mutations[i].removedNodes.length; n++)
		{
			if (mutations[i].removedNodes[n] === initMenu.elMenu)
				initMenu.elHeader.append(initMenu.elMenu);

		}
	}
}).observe(document.documentElement, {
	subtree: true,
	childList: true
});

/**
 * A function that reads and writes data to the browser's local storage.
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
	const dataDefault = {
		freeOnly: 0, /* show free only */
		resolveLinks: 1, /* use resolved links by default*/
		noAds: 1, /* remove ads */
		debug: 0 /* debug mode */
	};
	let data = Object.assign({}, dataDefault);
	try
	{
		Object.assign(data, JSON.parse(localStorage.getItem(LocalStorageName)));
	}
	catch{}
	if (Object.prototype.toString.call(data) !== "[object Object]")
		data = Object.assign({}, dataDefault);

	/* clean up old settings */
	const reg = /^\d/;
	for(const i in data)
	{
		if (reg.test(i))
			continue;

		/* upgrade from v1.14 */
		if (i === "resolvedClick")
			data.resolveLinks = data[i];

		if (!Object.prototype.hasOwnProperty.call(dataDefault, i))
			delete data[i];

	}
	//each setting is a class name
	document.addEventListener("DOMContentLoaded", () =>
	{
		for(const i in data)
			document.body.classList.toggle(i, !!data[i]);
	});
	const cache = new Map(Object.entries(data));
	let timer;
	let timeout;
	/**
	 * Saves the data in the cache to the browser's local storage.
	 * @param {number} [attempt=0] - The number of times the function has attempted to save the data.
	 */
	const save = (attempt = 0) =>
	{
		clearTimeout(timeout);
		const now = Date.now();
		if (timer + 300 > now)
		{
			timeout = setTimeout(() => save(attempt), 300);
			return;
		}
		try
		{
			// try save settings, if it fails, remove previous items until it succeeds
			localStorage.setItem(LocalStorageName, JSON.stringify(Object.fromEntries(cache)));
		}
		catch
		{
			//removing in batches exponentially
			for(let i = 0, key, keys = cache.keys(), count = ++attempt ** 2; i < count; i++)
			{
				do
				{
					key = keys.next().value;
				}
				while(key && !/^\d/.test(key)); //don't remove non-numeric keys

				cache.delete(key);
			}

			if (attempt < 10_000)
				return save(attempt);

		}
		timer = now;
	};

	return	new Proxy((id, value) =>
	{
		if (value === undefined)
			return cache.get(id);

		cache.set(id, value);
		if (id === "resolveLinks")
			updateLinks();

		document.body.classList.toggle(id, !!value);
		save();
	},
	{
		get: (target, id) => target(id),
		set: (target, id, value) =>
		{
			target(id, value);
			return true;
		}
	});
})();

/**
 * Returns the first element that is a descendant of node that matches selectors.
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
 * @param {string} t - The string to trim.
 * @returns {string} The trimmed string.
 */
const trim = t => ("" + t).trim();

/**
 * Divides a price by a specified divider and formats it as a string with a dollar sign and two decimal places.
 * @param {string} _text - The text to prepend to the formatted price.
 * @param {string} divider - The value to divide the price by.
 * @param {string} price - The price to divide and format.
 * @returns {string} The formatted price with the specified text prepended to it.
 */
const priceDivide = (_text, divider, price) => "$" + (Number.parseFloat(price.replace(/,/g, "") / Number.parseFloat(divider))).toFixed(2);

/**
 * Extracts pricing information from a given node and its children.
 * @param {HTMLElement|NodeList} node - The root node or NodeList to search for pricing information.
 * @param {boolean} [force=false] - Whether to force processing of already processed items.
 * @returns void
 */
const processCards = (node, force) =>
{
	const processed = (force ? "-" : "") + processedMarker;
	const nlItems = node instanceof NodeList
		? node
		: $$(	`.salePrice:not(.${processed}),` +
				`.itemPrice:not(.${processed}),` +
				`.price:not(.${processed}),` +
				`.bp-p-dealCard_price:not(.${processed}),` + // https://slickdeals.net/deals/watches/
				`.dealCard__price:not(.${processed}),` +
				`.dealPrice:not(.${processed})`
		, node, true) || [];

	for (let i = 0; i < nlItems.length; i++)
	{
		const elPrice = nlItems[i];
		elPrice.classList.add(processedMarker);
		let elParent = elPrice.parentNode;
		const price = trim(elPrice.textContent);
		let priceNew = Number.NaN;
		if (price)
		{
			if ((price.toLowerCase() === "free"))
				priceNew = 0;
			else if (/^[\s\w]*~?\$/.test(price))
			{
				priceNew = Number.parseFloat(price
					.replace(/^(\d+) for \$?([\d,.]+)/g, priceDivide) // 2 for $10
					.replace(/[^\d,.]/g, "") // remove non-numeric characters
					.replace(/,/g, "")); // remove commas
			}

		}
		const priceFree = price && price.match(/or free/i) || priceNew === 0;
		const elPriceRetail = $$(".retailPrice", elParent);
		const elPriceOld = $$(".oldListPrice, .dealCard__originalPrice, .bp-p-dealCard_originalPrice", elParent);
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
			.replace(/^[\s\w]*\$([\d,.]+)/g, "$1")
			.replace(/,/g, ""));

		const priceOld = Number.parseFloat(trim((elPriceOld || {}).textContent)
			.replace(/^[\s\w]*\$([\d,.]+)/g, "$1")
			.replace(/,/g, ""));

		const priceDifference = (priceOld || priceRetail) - priceNew;
		const priceDealPercent = Math.round(priceDifference * 100 / (priceOld || priceRetail));
		const elCard = elParent.closest(
			"li," +
			"div[data-type='fpdeal']," +
			"div.resultRow," +
			"div[data-role='frontpageDealContent']"
		);
		if (elCard)
			elCard.classList.toggle("free", priceFree);

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
		}
	}
};

/**
 * Logs debug information to the console if debug mode is enabled.
 * @param {...*} args - The arguments to log to the console.
 */
const debug = Object.assign(SETTINGS.debug ? console.log.bind(console) : () => {}, {trace: console.trace.bind(console)});

/**
 * Fixes links on a given node by replacing the href with a new URL based on the deal ID and type.
 * @param {HTMLElement|NodeList} node - The root node or NodeList to search for links to fix.
 * @param {boolean} [force=false] - Whether to force processing of already processed links.
 * @returns {void}
 */
const processLinks = (node, force) =>
{
	const processed = (force ? "-" : "") + processedMarker;
	const nlLinks = node instanceof NodeList || Array.isArray(node) ? node : $$(`a:not(.${processed}):not(.overlayUrl)`, node, true) || [];
	for(let i = 0; i < nlLinks.length; i++)
	{
		const elLink = nlLinks[i];

		if (elLink._hrefResolved && !force)
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
		const u = elLink.href.match(/(\?|&|&amp;)u2=([^#&]*)/i);
		let url = u ? decodeURIComponent(u[2]) : SETTINGS(id + type);

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
		if (SETTINGS.resolveLinks)
		{
			const dsLoading = new Proxy([document.documentElement.dataset], {
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
			if (dsLoading.loading === undefined)
				dsLoading.loading = 0;

			dsLoading.loading++;
			resolveUrl(id, type, elLink._hrefOrig)
				.then(data =>
				{
					if (!data)
						throw new Error("No data:" + data);

					if (id === data.id
						&& type === data.type
						&& data.url
						&& !/^https:\/\/(www\.)?slickdeals.net\/\?/i.test(data.url))
					{
						SETTINGS(id + type, data.url);
						for(let i = 0; i < aLinks.length; i++)
							linkUpdate(aLinks[i], data.url);

						aLinks.resolved = true;
					}
					return data;
				})
				.finally(() =>
				{
					if (!--dsLoading.loading)
						delete dsLoading.loading;

				})
				.catch(console.error);
		}
	}
};

/**
 * Updates a link with a new URL and styling to indicate that it has been resolved.
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
 * @param {string} id - The ID of the deal to resolve.
 * @param {string} type - The type of the deal to resolve.
 * @param {string} url - The URL to resolve.
 * @returns {Promise} A Promise that resolves with the data returned from the Slickdeals API.
 */
const resolveUrl = (id, type, url) => fetch(api + id + type, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify([url,location.href]), referrerPolicy: "unsafe-url"})
	.then(r => r.json())
	.catch(console.error);

/**
 * Extracts the ID and type of a deal from a given URL.
 * @param {string} url - The URL to extract the ID and type from.
 * @returns {Object|boolean} An object containing the ID and type of the deal, or false if no ID or type could be found.
 */
const getUrlInfo = url =>
{
	const ids = ["pno", "tid", "sdtid"];
	const queryConvert = {
		sdtid : "tid"
	};
	let matchIDS;

	for (let i = 0; i < ids.length; i++)
	{
		matchIDS = new RegExp("(\\?|(&|&amp;))((" + ids[i] + ")=([^&]+))", "i").exec(url);//url.match(r);
		if (matchIDS)
			break;
	}
	if (!matchIDS)
		return false;

	matchIDS[4] = queryConvert[matchIDS[4]] || matchIDS[4];
	const matchLNO = url.match(/(\?|(&|&amp;))lno=(\d+)/i);
	if (matchLNO)
		matchIDS[5] += "-" + matchLNO[3];
	return {id: matchIDS[5], type: matchIDS[4]};
};

/**
 * Initializes the Slickdeals+ menu.
 * @param {HTMLElement} elNav - The navigation element to use as the menu container.
 */
const initMenu = elNav =>
{
	// header.firstChild.firstChild.style.padding = 0;
	let elMenuItem;
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

	elMenu.classList.add("spd-menu");
	elMenu.dataset.qaHeaderDropdownButton = "slickdeals-plus";
	elMenu.querySelector("p").textContent = "Slickdeals+";
	const elUl = elMenu.querySelector("ul");
	const elButton = elMenu.querySelector("div[role='button']");
	elMenu.addEventListener("mousedown", evt =>
	{
		const isMenu = evt.target === elButton || evt.target.parentElement === elButton;
		const isMenuOpen = (document.activeElement.closest(".spd-menu > div[role='button']") || {}) === elButton;

		if (isMenu && isMenuOpen)
		{
			evt.preventDefault();
			evt.stopPropagation();
			elOverlay.click();
		}
	});

	elButton.addEventListener("focus", () => elHeader.after(elOverlay), true);
	elButton.addEventListener("blur", () => elOverlay.remove(), true);
	elOverlay.addEventListener("click", () =>
	{
		elButton.focus();
		elButton.blur();
		elOverlay.remove();
	});
	const loading = document.documentElement.dataset.loading;
	if (loading)
		elMenu.dataset.loading = loading;

	elUl.dataset.qaHeaderDropdownList = "slickdeals-plus";
	const elLiDefault = elUl.querySelector("li").cloneNode(true);
	const dataset = Object.keys(elLiDefault.firstElementChild.dataset)[0];
	elUl.innerHTML = "";
	elLiDefault.innerHTML = "";
	elNav.append(elMenu);

	let elLi;

	let id = "freeOnly";
	elMenuItem = menuItem(id);
	elMenuItem.dataset[dataset] = "";
	elMenuItem.classList.add("slickdealsHeaderDropdownItem__link");
	elMenuItem.title = "Only show free items";
	elMenuItem.textContent = "Free Only";
	elLi = elLiDefault.cloneNode(true);
	elLi.classList.add(id);
	elLi.append(elMenuItem);
	elUl.append(elLi);

	id = "resolveLinks";
	elMenuItem = menuItem(id);
	elMenuItem.dataset[dataset] = "";
	elMenuItem.classList.add("slickdealsHeaderDropdownItem__link");
	elMenuItem.title = "Use resolved links";
	elMenuItem.textContent = "Resolved links";
	elLi = elLiDefault.cloneNode(true);
	elLi.classList.add(id);
	if (loading)
		elLi.dataset.loading = loading;

	elLi.append(elMenuItem);
	elUl.append(elLi);

	id = "noAds";
	elMenuItem = menuItem(id);
	elMenuItem.dataset[dataset] = "";
	elMenuItem.classList.add("slickdealsHeaderDropdownItem__link");
	elMenuItem.title = "Block ads. Require page refresh";
	elMenuItem.textContent = "No ads";
	elLi = elLiDefault.cloneNode(true);
	elLi.classList.add(id);
	elLi.append(elMenuItem);
	elUl.append(elLi);
};

/**
 * Creates a menu item element with a label and style.
 * @param {string} id - The ID of the menu item.
 * @returns {HTMLElement} The menu item element.
 */
const menuItem = id =>
{
	const elMenuItem = document.createElement("a");
	elMenuItem.addEventListener("click", () => SETTINGS(id, ~~!SETTINGS(id)));
	elMenuItem.addEventListener("keypress", evt =>
	{
		if (evt.key === " " || evt.key === "Enter")
		{
			evt.preventDefault();
			evt.stopPropagation();
			SETTINGS(id, ~~!SETTINGS(id));
		}
	});
	elMenuItem.id = id;
	elMenuItem.setAttribute("tabindex", 0);
	const elStyle = document.createElement("style");
	elStyle.textContent = `body.${id} #${id}::before{content:"☑";}`;
	document.head.append(elStyle);
	return elMenuItem;
};

/**
 * The main function that runs when the page is loaded.
 */
const main = () =>
{
	window.removeEventListener("DOMContentLoaded", main, false);
	window.removeEventListener("load", main, false);

	const isDarkMode = document.body.matches("[class*=darkMode]"); //bp-s-darkMode

	document.body.classList.toggle("darkMode", isDarkMode);
	const style = document.createElement("style");
	style.innerHTML = css;
	document.head.append(style);

	//for some reason observer failed to process everything while page is still loading, so we do it manually
	const elPageContent = $$("pageContent");
	if (elPageContent)
	{
		processCards(elPageContent);
		processLinks(elPageContent);
	}
	debug(GM_info.script.name, "v" + GM_info.script.version, "initialized");
};//main()

if (document.readyState === "complete")
	main();
else
{
	window.addEventListener("DOMContentLoaded", main, false);
	window.addEventListener("load", main, false);
}
})(`
a.resolved:not(.seeDealButton):not(.button.success)
{
	color: #00b309;
}

.seeDealButton.resolved
{
	--buttonBackgroundColor: #0c9144;
}
.seeDealButton.resolved:hover
{
	--buttonBackgroundColor: #0b7b1d;
}
.seeDealButton.resolved:active
{
	--buttonBackgroundColor: #06551a;
}

div.free,
li.free
{
	background-color: #ffdde0 !important;
	animation: pulse .5s infinite alternate;
}

@keyframes pulse
{
	from { box-shadow: 0 0 1em red;}
	to {box-shadow: 0 0 0.5em red;}
}
body.darkMode div.free,
body.darkMode li.free
{
	background-color: #861614 !important;
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
	background-color: #ffffff7f;
	background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9ImN1cnJlbnRDb2xvciIgcHJlc2VydmVBc3BlY3RSYXRpbz0ieE1pbllNaW4gbWVldCIgdmlld0JveD0iMCAwIDEwIDExIj4KICA8cGF0aCBmaWxsPSJpbmhlcml0IiBkPSJtOC40NjUuNTQ2Ljk5Ljk5YTEuODcgMS44NyAwIDAgMS0uMDAyIDIuNjRsLTEuMzIgMS4zMmExLjQxMiAxLjQxMiAwIDAgMS0xLjUyNS4zMDMuNDY3LjQ2NyAwIDAgMSAuMzU3LS44NjJjLjE3NC4wNy4zNzQuMDMuNTA5LS4xMDJsMS4zMjEtMS4zMTdhLjkzMy45MzMgMCAwIDAgMC0xLjMybC0uOTktLjk5YS45MzMuOTMzIDAgMCAwLTEuMzIgMGwtMS4zMiAxLjMyYS40NjcuNDY3IDAgMCAwLS4xLjUwNi40NjcuNDY3IDAgMSAxLS44NjMuMzU3IDEuNDAzIDEuNDAzIDAgMCAxIC4zMDMtMS41MjZsMS4zMi0xLjMyYTEuODcgMS44NyAwIDAgMSAyLjY0IDBaIi8+CiAgPHBhdGggZmlsbD0iaW5oZXJpdCIgZD0iTTMuMDIgNi45OGEuNDcuNDcgMCAwIDAgLjY2IDBsMy42My0zLjYzYS40NjcuNDY3IDAgMCAwLS42Ni0uNjZMMy4wMiA2LjMyYS40NjcuNDY3IDAgMCAwIDAgLjY2WiIvPgogIDxwYXRoIGZpbGw9ImluaGVyaXQiIGQ9Ik01LjE5IDYuMzU3YS40NjcuNDY3IDAgMCAwLS4yNTMuNjEuNDY3LjQ2NyAwIDAgMS0uMTAyLjUwOGwtMS4zMiAxLjMyYS45MzMuOTMzIDAgMCAxLTEuMzIgMGwtLjk5LS45OWEuOTMzLjkzMyAwIDAgMSAwLTEuMzJsMS4zMjItMS4zMmEuNDczLjQ3MyAwIDAgMSAuNTEtLjEuNDY3LjQ2NyAwIDAgMCAuMzU1LS44NjQgMS40MTYgMS40MTYgMCAwIDAtMS41MjUuMzA1TC41NDYgNS44MjZhMS44NyAxLjg3IDAgMCAwIDAgMi42NGwuOTkuOTljLjcyOS43MjggMS45MS43MjggMi42NCAwbDEuMzItMS4zMmMuNC0uNDAxLjUyLTEuMDAzLjMwMy0xLjUyN2EuNDY3LjQ2NyAwIDAgMC0uNjEtLjI1MloiLz4KPC9zdmc+");
	background-position: center;
	background-repeat: no-repeat;
	padding: 0.5em 1em;
	left: .1em;
	opacity: 0.5;
}

a.overlayUrl:hover::before
{
	opacity: 1;
}

a:hover > a.overlayUrl
{
	display: inline;
}

.hidden
{
	display: none !important;
}

body.freeOnly .frontpageRecommendationCarousel li:not(.free),
body.freeOnly .dealTiles li:not(.free),
body.freeOnly .bp-p-categoryPage_main li:not(.free), /* https://slickdeals.net/deals/*** */
body.freeOnly .frontpageGrid li:not(.free)
{
	display: none;
}

/* checkboxes */

.spd-menu .slickdealsHeaderDropdownItem
{
	cursor: pointer;
}

.spd-menu .slickdealsHeaderDropdownItem > a::before
{
	content: "☐";
	display: inline-block;
	width: 1em;
	height: 1em;
	line-height: 1em;
	font-size: 1.3em;
	margin: 0 0.1em;
}

/* end checkboxes */

:root[data-loading] .spd-menu::before,
:root[data-loading] .spd-menu::after,
:root[data-loading] .spd-menu .slickdealsHeader__navItemText::before,
:root[data-loading] .spd-menu .slickdealsHeader__navItemText::after
{
	position: absolute;
	z-index: 1;
	pointer-events: none;
}

@media (min-width: 1024px)
{
	:root[data-loading] .spd-menu
	{
		position: relative;
	}
	:root[data-loading] .spd-menu::before
	{
		content: "⌛";
		right: 0.1em;
		line-height: 2.5em;
		animation: spin 1s linear infinite;
	}
	:root[data-loading] .spd-menu::after
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
}

@media (max-width: 1023px)
{
	:root[data-loading] .spd-menu .slickdealsHeader__navItemText
	{
		position: relative;
		overflow: unset !important;
	}
	:root[data-loading] .spd-menu .slickdealsHeader__navItemText::before
	{
		content: "⌛";
		right: -1.5em;
		line-height: 2.0em;
		animation: spin 1s linear infinite;
	}
	:root[data-loading] .spd-menu .slickdealsHeader__navItemText::after
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

.dealCard__priceContainer
{
	display: unset !important;
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
}

.cardPriceInfo[data-deal-diff]::after, /* https://slickdeals.net/deals/*** */
.dealDetailsPriceInfo[data-deal-diff]::after, /* deal details page */
a[data-deal-diff]::after /* deal list page */
{
	content: "($" attr(data-deal-diff) " | " attr(data-deal-percent) "%)";
	font-style: italic;
	height: 1em;
}

@media (min-width: 768px) {
	.dealCard__content {
		grid-template-rows:auto 67px auto 1fr 20px !important;
	}
}

`/* eslint-disable-next-line unicorn/no-array-reduce, arrow-spacing, space-infix-ops, unicorn/prefer-number-properties, unicorn/no-array-for-each, no-shadow, unicorn/prefer-code-point*/,
"szdcogvyz19rw0xl5vtspkrlu39xtas5e6pir17qjyux7mlr".match(/.{1,6}/g).reduce((Ⲟ,ꓳ,𐊒)=>([24,16,8,0].forEach(𐓂=>(𐊒=parseInt(ꓳ,36)>>𐓂&255,Ⲟ+=String.fromCharCode(𐊒))),Ⲟ),""));