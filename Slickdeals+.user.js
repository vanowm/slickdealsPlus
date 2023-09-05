// ==UserScript==
// @name         Slickdeals+
// @namespace    V@no
// @description  Various enhancements
// @include      https://slickdeals.net/*
// @version      1.16
// @license      MIT
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function (css, api)
{
"use strict";
if (window.top !== window.self)
	return;

const LocalStorageName = "slickdeals+";
// upgrade from v1.12
{
	const oldData = localStorage.getItem("linksCache");
	if (oldData)
	{
		localStorage.setItem(LocalStorageName, oldData);
		localStorage.removeItem("linksCache");
	}
}
const linksData = {};
const processedMarker = "sdp"; //class name indicating that the element has already been processed

/**
 * Track changes in the DOM
 */
new MutationObserver(mutations =>
{
	for (let i = 0; i < mutations.length; i++)
	{
		// do we need to worry about tracked links being changed?
		// if (mutations[i].type === "attributes")
		// {
		// 	const el = mutations[i].target;
		// 	//the tracking links can change dynamically, update them if they do
		// 	if (el._hrefResolved && el.href !== el._hrefResolved && el.href !== el._hrefOrig)
		// 		linkUpdate(el, el.href, true);
		// }
		for (let n = 0; n < mutations[i].addedNodes.length; n++)
		{
			const node = mutations[i].addedNodes[n];

			if (!node.classList)
				continue;

			/* remove ads */
			if (SETTINGS.noAds)
			{
				if (node.tagName === "IFRAME")
				{
					console.log("Slickdeals+ blocked iframe", node.src);
					node.remove();
					continue;
				}
				if (node.tagName === "SCRIPT"
					&& ((node.src && !/slickdeals/.test(new URL(node.src).hostname))
						|| /([.:-]ads(loader|[.:-])|banner)/i.test(node.textContent)))
				{
					console.log("Slickdeals+ blocked script", node.src);
					node.remove();
					continue;
				}

				if (node.matches(".ablock,.adunit"))
				{
					if (node.parentElement.matches(".subBoxContent"))
						node.parentElement.parentElement.remove();

					node.parentElement.remove();
				}
			}
			/* end remove ads */

			if (node.classList.contains(processedMarker))
				continue;

			processCards(node);
			processLinks(node);
		}
	}
}).observe(document, {
	// attributeFilter: ["href"],
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
	const dataDefault = {
		freeOnly: 0, /* show free only */
		resolveLinks: 1, /* use resolved links by default*/
		noAds: 1 /* remove ads */
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
		{
			updateLinks();
		}
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
 * @returns {Array} An array of objects containing pricing information for each item found.
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

	// const result = [];
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
		{
			if (priceFree)
				elCard.setAttribute("free", "");
			else
				elCard.removeAttribute("free");
		}

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
		// result.push({
		// 	item: item,
		// 	price: price,
		// 	priceNew : priceNew,
		// 	priceRetail: priceRetail,
		// 	priceOld: priceOld
		// });

		// console.log({price, priceNew, priceRetail, priceOld, priceDealPercent, elItem, elCard});
	}
	// return result;
};

/**
 * Fixes links on a given node by replacing the href with a new URL based on the deal ID and type.
 * @param {HTMLElement|NodeList} node - The root node or NodeList to search for links to fix.
 * @param {boolean} [force=false] - Whether to force processing of already processed links.
 * @returns {void}
 */
const processLinks = (node, force) =>
{
	const processed = (force ? "-" : "") + processedMarker;
	const nlLinks = node instanceof NodeList ? node : $$(`a:not(.${processed})`, node, true) || [];

	for(let i = 0; i < nlLinks.length; i++)
	{
		const elLink = nlLinks[i];

		if (elLink._hrefResolved)
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
			elHover.classList.add(processedMarker, "origUrl", "hidden");
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
			const dsLoading = document.documentElement.dataset;
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
 */
const linkUpdate = (elA, url, update) =>
{
	// elA.classList.remove("alert");
	if (elA._hrefResolved && !update)
		return;

	if (url)
		elA._hrefResolved = url;

	elA.classList.toggle("notResolved", !elA._hrefResolved);
	const elHover = elA.querySelector("a.origUrl");
	if (SETTINGS.resolveLinks && elA._hrefResolved)
	{
		elHover.title = "Original link";
		elHover.href = elA._hrefOrig;
		elHover.classList.remove("hidden");
		elA.href = elA._hrefResolved;
		elA.classList.add("resolved");
		elA.classList.remove("tracked");
	}
	else
	{
		elHover.classList.toggle("hidden", !elA._hrefResolved);
		elHover.title = "Resolved link";
		elHover.href = elA._hrefResolved;
		elA.href = elA._hrefOrig;
		elA.classList.add("tracked");
		elA.classList.remove("resolved");
	}
	// a.title = a._hrefResolved;
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

const initMenu = elHeader =>
{
	// header.firstChild.firstChild.style.padding = 0;
	let elLabel;
	const elLiMenu = elHeader.lastElementChild.cloneNode(true);
	elLiMenu.classList.add("spd-menu");
	elLiMenu.dataset.qaHeaderDropdownButton = "slickdeals-plus";
	elLiMenu.querySelector("p").textContent = "Slickdeals+";
	const elUl = elLiMenu.querySelector("ul");

	elUl.dataset.qaHeaderDropdownList = "slickdeals-plus";
	const elLiDefault = elUl.querySelector("li").cloneNode(true);
	const dataset = Object.keys(elLiDefault.firstElementChild.dataset)[0];
	elUl.innerHTML = "";
	elLiDefault.innerHTML = "";
	elHeader.append(elLiMenu);

	let elLi;

	let id = "freeOnly";
	elLabel = checkbox(id).label;
	elLabel.dataset[dataset] = "";
	elLabel.classList.add("slickdealsHeaderDropdownItem__link");
	elLabel.title = "Only show free items";
	elLabel.textContent = "Free Only";
	elLi = elLiDefault.cloneNode(true);
	elLi.classList.add(id);
	elLi.append(elLabel);
	elUl.append(elLi);

	id = "resolveLinks";
	elLabel = checkbox(id).label;
	elLabel.dataset[dataset] = "";
	elLabel.classList.add("slickdealsHeaderDropdownItem__link");
	elLabel.title = "Use resolved links";
	elLabel.textContent = "Resolved links";
	elLi = elLiDefault.cloneNode(true);
	elLi.classList.add(id);
	elLi.append(elLabel);
	elUl.append(elLi);

	id = "noAds";
	elLabel = checkbox(id).label;
	elLabel.dataset[dataset] = "";
	elLabel.classList.add("slickdealsHeaderDropdownItem__link");
	elLabel.title = "Block ads. Require page refresh";
	elLabel.textContent = "No ads";
	// elLabel.setAttribute("label", "No ads");
	elLi = elLiDefault.cloneNode(true);
	elLi.classList.add(id);
	elLi.append(elLabel);
	// elBefore.before(elLi);
	elUl.append(elLi);
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

	const elHeader = $$(".slickdealsHeader__hamburgerDropdown .slickdealsHeader__linkSection");
	if (elHeader)
		initMenu(elHeader);

	//for some reason observer failed to process everything while page is still loading, so we do it manually
	const elPageContent = $$("pageContent");
	if (elPageContent)
	{
		processCards(elPageContent);
		processLinks(elPageContent);
	}
	console.log(GM_info.script.name, "v" + GM_info.script.version, "initialized");
};//main()

const checkbox = id =>
{
	const elInput = document.createElement("input");
	const elLabel = document.createElement("label");
	elInput.type = "checkbox";
	elInput.id = id;
	elInput.checked = SETTINGS[id];
	elInput.className = "hidden";
	elInput.addEventListener("input", () => SETTINGS(id, ~~elInput.checked));
	elLabel.setAttribute("for", id);
	elLabel.className = id;
	document.body.insertBefore(elInput, document.body.firstChild);
	const elStyle = document.createElement("style");
	elStyle.textContent = `#${id}:checked ~ * label.${id}::before{content:"☑";}`;
	document.head.append(elStyle);
	return {label: elLabel, input: elInput};
};

if (document.readyState === "complete")
	main();
else
{
	window.addEventListener("DOMContentLoaded", main, false);
	window.addEventListener("load", main, false);
}
})(`
a.resolved:not(.seeDealButton)
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

div[free],
li[free]
{
	box-shadow: 0 0 10px red;
	background-color: #ffdde0 !important;
}
#freeOnly:checked ~ * label.freeOnly
{
	text-shadow: 0 0 20px #f00;

}
body.darkMode div[free],
body.darkMode li[free]
{
	box-shadow: 0 0 10px red;
	background-color: #861614 !important;
	/* color: black; */
}
#fpMainContent .gridCategory .fpGridBox.list[free],
#fpMainContent .gridCategory .fpGridBox.simple[free]
{
	margin: 5px;
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
a.origUrl
{
	position: relative;
	height: 1em;
	display: none;
}

a.origUrl::before,
a.origUrl::after
{
	content: "";
	position: absolute;
	height: 1.3em;
	top: -0.1em;

}

a.origUrl::after
{
	width: 2.2em;
}

a.origUrl::before
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

a.origUrl:hover::before
{
	opacity: 1;
}

a:hover > a.origUrl
{
	display: inline;
}
.omegaBanner,
.frontpageGrid__bannerAd,
.frontpageSlickdealsGrid__bannerAd,
.hidden
{
	display: none !important;
}

#freeOnly:checked ~ * .frontpageRecommendationCarousel li:not([free]),
#freeOnly:checked ~ * .dealTiles li:not([free]),
#freeOnly:checked ~ * .bp-p-categoryPage_main li:not([free]), /* https://slickdeals.net/deals/*** */
#freeOnly:checked ~ * .frontpageGrid li:not([free])
{
	display: none;
}

/* checkboxes */

.spd-menu .slickdealsHeaderDropdownItem > label
{
	cursor: pointer;
}

.spd-menu .slickdealsHeaderDropdownItem > label::before
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

:root[data-loading] .spd-menu
{
	position: relative;
}

:root[data-loading] .spd-menu::after
{
	content: "⌛";
	position: absolute;
	right: -0.2em;
	line-height: 2.5em;
	animation: spin 1s linear infinite;
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