// ==UserScript==
// @name         Slickdeals+
// @namespace    V@no
// @description  Various enhancements
// @include      https://slickdeals.net/*
// @version      1.13.1
// @license      MIT
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function (api)
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
			if (!node.classList || node.classList.contains(processedMarker))
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
		resolvedShow: 1, /* show resolved links */
		resolvedClick: 0 /* use resolved links on click */
	};
	let data = Object.assign({}, dataDefault);
	try
	{
		Object.assign(data, JSON.parse(localStorage.getItem(LocalStorageName)));
	}
	catch{}
	if (Object.prototype.toString.call(data) !== "[object Object]")
		data = Object.assign({}, dataDefault);

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
			//removing in batches
			for(let i = 0, key, keys = cache.keys(), count = ++attempt * 10; i < count; i++)
			{
				do
				{
					key = keys.next().value;
				}
				while(key && !/^\d/.test(key)); //don't remove non-numeric keys

				cache.delete(key);
			}

			if (++attempt < 10_000)
				return save(attempt);

		}
		timer = now;
	};

	return	new Proxy((id, value) =>
	{
		if (value === undefined)
			return cache.get(id);

		cache.set(id, value);
		if (id === "resolvedShow" || id === "resolvedClick")
		{
			updateLinks(value);
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

const updateLinks = show =>
{
	for(const id in linksData)
	{
		const aLinks = linksData[id];
		for(let i = 0; i < aLinks.length; i++)
		{
			const elLink = aLinks[i];
			linkUpdate(elLink, undefined, true);

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
 * Trims whitespace from a given string.
 * @param {string} t - The string to trim.
 * @returns {string} The trimmed string.
 */
const trim = t => ("" + t).trim();

/**
 * Divides a price by a specified divider and formats it as a string with a dollar sign and two decimal places.
 * @param {string} text - The text to prepend to the formatted price.
 * @param {string} divider - The value to divide the price by.
 * @param {string} price - The price to divide and format.
 * @returns {string} The formatted price with the specified text prepended to it.
 */
const priceDivide = (text, divider, price) => "$" + (Number.parseFloat(price.replace(/,/g, "") / Number.parseFloat(divider))).toFixed(2);

/**
 * Extracts pricing information from a given node and its children.
 * @param {HTMLElement} node - The root node to search for pricing information.
 * @returns {Array} An array of objects containing pricing information for each item found.
 */
const processCards = (node, force) =>
{
	const processed = (force ? "-" : "") + processedMarker;
	const nlItems = $$(	`.salePrice:not(.${processed}),` +
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
			else if (/^[\s\w]*\$/.test(price))
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
 * @param {HTMLElement} node - The root node to search for links to fix.
 */
const processLinks = (node, force) =>
{
	const processed = (force ? "-" : "") + processedMarker;
	const nlLinks = $$(`a:not(.${processed})`, node, true) || [];
	for(let i = 0; i < nlLinks.length; i++)
	{
		const elLink = nlLinks[i];

		if (elLink._hrefResolved)
			continue;

		elLink.classList.add(processedMarker);
		const {id, type} = getIdFromUrl(elLink.href) || {};
		if (!id)
			continue;

		elLink._hrefOrig = elLink.href;
		const elHover = document.createElement("a");
		elHover.href = elLink._hrefOrig;
		elHover.classList.add(processedMarker, "origUrl");
		elHover.title = "Original link";
		elHover.target = elLink.target;
		elLink.append(elHover);

		const u = elLink.href.match(/(\?|&|&amp;)u2=([^#&]*)/i);
		let url = u ? decodeURIComponent(u[2]) : SETTINGS(id + type);

		const isResolved = linksData[id];
		if (!isResolved)
		{
			linksData[id] = [elLink];
		}

		if (!linksData[id].includes(elLink))
			linksData[id].push(elLink);

		if (!elLink._hrefResolved)
		{
			elLink.classList.add("alert");
			elLink.classList.remove("successBtn");
		}
		if (url)
		{
			if (Array.isArray(url))
				url = url[0];

			linkUpdate(elLink, url);
			continue;
		}
		if (!isResolved)
			resolveUrl(id, type, elLink._hrefOrig);
	}
};

/**
 * Updates a link with a new URL and styling to indicate that it has been resolved.
 * @param {HTMLAnchorElement} elA - The link to update.
 * @param {string} url - The new URL to set on the link.
 */
const linkUpdate = (elA, url, update) =>
{
	elA.classList.add("successBtn");
	elA.classList.remove("alert");
	if (elA._hrefResolved && !update)
		return;

	if (!elA._hrefResolved && url)
	{
		elA.addEventListener("mousedown", evt =>
		{
			if (!evt.isTrusted || !evt.target._hrefResolved)
				return;

			if (SETTINGS.resolvedClick && !SETTINGS.resolvedShow)
				elA.href = elA._hrefResolved;
			else if (!SETTINGS.resolvedClick && SETTINGS.resolvedShow)
				elA.href = elA._hrefOrig;
			else return;

			evt.preventDefault();
			elA.click();
			elA.href = SETTINGS.resolvedShow ? elA._hrefResolved : elA._hrefOrig;
		}, false);
	}
	if (url)
		elA._hrefResolved = url;

	const elHover = elA.querySelector("a.origUrl");
	if (SETTINGS.resolvedShow)
	{
		elA.href = elA._hrefResolved;
		elHover.title = "Original link";
		elHover.href = elA._hrefOrig;
	}
	else
	{
		elA.href = elA._hrefOrig;
		elHover.title = "Resolved link";
		elHover.href = elA._hrefResolved;
	}
	if (SETTINGS.resolvedClick)
	{
		elA.classList.add("resolved");
		elA.classList.remove("tracked");
	}
	else
	{
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
const resolveUrl = (id, type, url) => fetch( api + id + "?t=" + type + "&u=" + encodeURIComponent(url) + "&r=" + encodeURIComponent(location.href),{referrerPolicy: "unsafe-url"})
	.then(r => r.json())
	.then(data =>
	{
		if (data.url && !/^https:\/\/(www\.)?slickdeals.net\/\?/i.test(data.url))
		{
			SETTINGS(data.id + data.type, data.url);
			const aLinks = linksData[data.id] || [];
			for(let i = 0; i < aLinks.length; i++)
				linkUpdate(aLinks[i], data.url);
		}
		return data;
	})
	.catch(console.error);

/**
 * Extracts the ID and type of a deal from a given URL.
 * @param {string} url - The URL to extract the ID and type from.
 * @returns {Object|boolean} An object containing the ID and type of the deal, or false if no ID or type could be found.
 */
const getIdFromUrl = url =>
{
	const ids = ["pno", "tid", "sdtid"];
	const queryConvert = {
		sdtid : "tid"
	};
	let matchIDS;

	for (let i = 0; i < ids.length; i++)
	{
		// const r = new RegExp("(\\?|(&|&amp;))((" + ids[i] + ")=([^&]+))", "i");
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
 * The main function that runs when the page is loaded.
 */
const main = () =>
{
	window.removeEventListener("DOMContentLoaded", main, false);
	window.removeEventListener("load", main, false);

	const isDarkMode = document.body.matches("[class*=darkMode]"); //bp-s-darkMode

	document.body.classList.toggle("darkMode", isDarkMode);
	//wrap hamburger menu
	for(let i = 0, nlStyle = document.head.querySelectorAll("style"); i < nlStyle.length; i++)
		nlStyle[i].textContent = nlStyle[i].textContent.replace(/\(min-width: 1024px\)/g, "(min-width: 1150px)");

	const style = document.createElement("style");
	style.innerHTML = `
.successBtn
{
	--buttonBackgroundColor: #14F572;
}
.seeDealButton.successBtn:not(:hover):not(:active)
{
	color: black;
}
.successBtn:hover
{
	--buttonBackgroundColor: #0EAC28;
}
.successBtn:active
{
	--buttonBackgroundColor: #0A7A26;
}

div[free],
li[free]
{
	box-shadow: 0 0 10px red;
	background-color: #ffdde0 !important;
}
#freeOnly:checked ~ * .freeOnly
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
	display: none !important;
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
	display: inline !important;
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

#resolvedClick:checked ~ * .resolvedClick::before,
#resolvedShow:checked ~ * .resolvedShow::before,
#freeOnly:checked ~ * .freeOnly::before
{
	content: "☑";
}

.sdp_menuItem
{
	width: 100%;
}

.sdp_menuItem > label
{
	cursor: pointer;
	display: inline-flex;
	align-items: center;
	padding-left: 0 !important;
	padding-right: 0.5em !important;
}

.sdp_menuItem > label::before
{
	content: "☐";
	display: inline-block;
	width: 1em;
	height: 1em;
	line-height: 1em;
	font-size: 1.3em;
	margin: 0 0.1em;
}

.sdp_menuItem > label::after
{
	content: attr(label);
	display: inline-block;
}

.sdp_menuItem .slickdealsHeader__navItemText
{
	font-weight: inherit !important;
}

/* end checkboxes */
a.tracked
{
	position: relative;
	z-index: 0;
	display: inline-flex;
}

a.tracked::before
{
	content: "";
	position: absolute;
	width: 100%;
	height: 100%;
	background-color: pink;
	opacity: 0.7;
	border-radius: inherit;
	z-index: -1;
	bottom: 0;

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
	`;
	document.head.append(style);
	const elHeader = $$(".slickdealsHeader__hamburgerDropdown .slickdealsHeader__linkSection");
	if (elHeader)
	{
		const dataset = Object.keys(elHeader.dataset)[0];
			// header.firstChild.firstChild.style.padding = 0;
		const elBefore = elHeader.lastElementChild;
		let elLabel;
		let elLi = elBefore.cloneNode(false);
		elLi.classList.add("sdp_menuItem");

		elLabel = checkbox("freeOnly").label;
		elLabel.dataset[dataset] = "";
		elLabel.classList.add("slickdealsHeader__navItemText", "slickdealsHeader__navItemWrapper");
		elLabel.title = "Only show free items";
		elLabel.setAttribute("label", "Free Only");
		elLi = elLi.cloneNode(false);
		elLi.append(elLabel);
		// elBefore.before(elLi);
		elHeader.append(elLi);

		elLabel = checkbox("resolvedShow").label;
		elLabel.dataset[dataset] = "";
		elLabel.classList.add("slickdealsHeader__navItemText", "slickdealsHeader__navItemWrapper");
		elLabel.title = "Show resolved links on hover";
		elLabel.setAttribute("label", "Show resolved");
		elLi = elLi.cloneNode(false);
		elLi.append(elLabel);
		// elBefore.before(elLi);
		elHeader.append(elLi);

		elLabel = checkbox("resolvedClick").label;
		elLabel.dataset[dataset] = "";
		elLabel.classList.add("slickdealsHeader__navItemText", "slickdealsHeader__navItemWrapper");
		elLabel.title = "Use resolved links on click";
		elLabel.setAttribute("label", "Use resolved");
		elLi = elLi.cloneNode(false);
		elLi.append(elLabel);
		// elBefore.before(elLi);
		elHeader.append(elLi);
	}
	console.log("slickdeals+ initialized");
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
	return {label: elLabel, input: elInput};
};

if (document.readyState === "complete")
	main();
else
{
	window.addEventListener("DOMContentLoaded", main, false);
	window.addEventListener("load", main, false);
}
// eslint-disable-next-line unicorn/no-array-reduce, arrow-spacing, space-infix-ops, unicorn/prefer-number-properties, unicorn/no-array-for-each, no-shadow, unicorn/prefer-code-point
})("szdcogvyz19rw0xl5vtspkrlu39xtas5e6pir17qjyux7mlr".match(/.{1,6}/g).reduce((a,b,c,d)=>(c=parseInt(b,36),[24,16,8,0].forEach(b=>(d=c>>b&255,a+=String.fromCharCode(d))),a),""));