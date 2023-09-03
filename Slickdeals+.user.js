// ==UserScript==
// @name         Slickdeals+
// @namespace    V@no
// @description  Various enhancements
// @include      https://slickdeals.net/*
// @version      1.11
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function (api)
{
if (window.top !== window.self)
	return;

const LocalStorageName = "linksCache";
const linksData = {};
const sdp = "sdp"; //class name indicating that the element has already been processed
const observer = new MutationObserver(mutations =>
{
	for (let i = 0; i < mutations.length; i++)
	{
		for (let n = 0; n < mutations[i].addedNodes.length; n++)
		{
			const node = mutations[i].addedNodes[n];
			if (!node.classList || node.classList.contains(sdp))
				continue;

			processCards(node);
			processLinks(node);
		}
	}
});
observer.observe(document, {
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
	let data;
	try
	{
		data = JSON.parse(localStorage.getItem(LocalStorageName));
	}
	catch{}
	if (Object.prototype.toString.call(data) !== "[object Object]")
		data = {};

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
			localStorage.setItem(LocalStorageName, JSON.stringify(Object.fromEntries(cache)));
		}
		catch
		{
			//removing in batches
			for(let i = 0, keys = cache.keys(), count = ++attempt; i < count; i++)
				cache.delete(keys.next().value);

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
const processCards = node =>
{
	const nlItems = $$(`.salePrice:not(.${sdp}),.itemPrice:not(.${sdp}),.price:not(.${sdp}),.bp-p-dealCard_price:not(.${sdp}),.dealCard__price:not(.${sdp})`, node, true) || [];
	// const result = [];

	for (let i = 0; i < nlItems.length; i++)
	{
		const elItem = nlItems[i];
		elItem.classList.add(sdp);
		const elParent = elItem.parentNode;
		const price = trim(elItem.textContent);
		const priceFree = price && price.match(/or free/i);
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
		const priceRetail = Number.parseFloat(trim(($$(".retailPrice", elParent) || {}).textContent)
			.replace(/^[\s\w]*\$([\d,.]+)/g, "$1")
			.replace(/,/g, ""));
		const priceOld = Number.parseFloat(trim(($$(".oldListPrice, .dealCard__originalPrice", elParent) || {}).textContent)
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
			elCard.classList.toggle("free", Boolean(priceNew === 0 || priceFree));

		if (!Number.isNaN(priceDealPercent))
		{
			const diff = priceDifference.toFixed(2).replace(/\.00$/, "");
			elParent.dataset.dealDiff = diff;
			elCard.dataset.dealDiff = diff;
			elParent.dataset.dealPercent = priceDealPercent;
			elCard.dataset.dealPercent = priceDealPercent;
		}
		// result.push({
		// 	item: item,
		// 	price: price,
		// 	priceNew : priceNew,
		// 	priceRetail: priceRetail,
		// 	priceOld: priceOld
		// });

		// console.log(price, priceNew, priceRetail, priceOld, priceDealPercent, elItem, elCard);
	}
	// return result;
};

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
 * Fixes links on a given node by replacing the href with a new URL based on the deal ID and type.
 * @param {HTMLElement} node - The root node to search for links to fix.
 */
const processLinks = node =>
{
	const nlLinks = $$(`a:not(.${sdp})`, node, true) || [];
	for(let i = 0; i < nlLinks.length; i++)
	{
		const elLink = nlLinks[i];

		elLink.classList.add(sdp);
		const {id, type} = getIdFromUrl(elLink.href) || {};
		if (!id)
			continue;

		elLink._hrefOrig = elLink.href;
		const elOrig = document.createElement("a");
		elOrig.href = elLink._hrefOrig;
		elOrig.className = sdp + " origUrl";
		elLink.append(elOrig);

		const u = elLink.href.match(/(\?|&|&amp;)u2=([^#&]*)/i);
		let url = u ? decodeURIComponent(u[2]) : SETTINGS(id + type);

		if (url)
		{
			if (typeof(url) === "object")
				url = url[0];

			linkUpdate(elLink, url);
			continue;
		}
		if (!elLink._resolved)
		{
			elLink.classList.toggle("alert", true);
			elLink.classList.toggle("successBtn", false);
		}
		if (!linksData[id])
		{
			linksData[id] = [elLink];
			resolveUrl(id, type, elLink._hrefOrig);
		}
		if (!linksData[id].includes(elLink))
			linksData[id].push(elLink);
	}
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
 * Updates a link with a new URL and styling to indicate that it has been resolved.
 * @param {HTMLAnchorElement} a - The link to update.
 * @param {string} url - The new URL to set on the link.
 */
const linkUpdate = (a, url) =>
{
	a._resolved = true;
	a.href = url;
	a.classList.toggle("successBtn", true);
	a.classList.toggle("alert", false);
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

.freeonly,
div.free,
li.free
{
	box-shadow: 0 0 10px red;
	background-color: #ffdde0 !important;
}
body.darkMode .freeonly,
body.darkMode div.free,
body.darkMode li.free
{
	box-shadow: 0 0 10px red;
	background-color: #861614 !important;
	/* color: black; */
}
#fpMainContent .gridCategory .fpGridBox.list.free,
#fpMainContent .gridCategory .fpGridBox.simple.free
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
	width: 3em;
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
	left: .5em;
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
#freeOnly
{
  display: none !important;
}

#freeOnly:checked ~ * .dealTiles li:not(.free),
#freeOnly:checked ~ * .blueprint li:not(.free),
#freeOnly:checked ~ * .frontpageGrid li:not(.free)
{
  display: none;
}
.freeonly
{
  cursor: pointer;
  line-height: 0;
  display: inline-block;
  margin-right: 0.5em;
  text-align: center;
  vertical-align: middle;

}
#freeOnly:checked ~ * .freeonly::before
{
  content: "☑";
}
.freeonly::before
{
  content: "☐";
  display: inline-block;
  height: 1em;
  width: 1em;
  line-height: 1em;
}

.dealCard__priceContainer
{
	display: unset !important;
}

a[data-deal-diff]::after
{
	content: "($" attr(data-deal-diff) " | " attr(data-deal-percent) "%)";
	font-style: italic;
}
`;
	document.head.append(style);
	const elInput = document.createElement("input");
	elInput.type = "checkbox";
	elInput.id = "freeOnly";
	elInput.checked = SETTINGS.freeOnly;
	elInput.addEventListener("input", () => SETTINGS("freeOnly", elInput.checked));
	document.body.insertBefore(elInput, document.body.firstChild);
	const elHeader = $$(".slickdealsHeaderSubNav__items");
	if (elHeader)
	{
			// header.firstChild.firstChild.style.padding = 0;
		const elLabel = document.createElement("label");
		elLabel.setAttribute("for", "freeOnly");
		elLabel.className = "freeonly headingRight";
		elLabel.title = "Free Only";
		const elLi = document.createElement("li");
		elLi.className = "slickdealsHeaderSubNav__item";
		elLi.append(elLabel);
		elHeader.insertBefore(elLi, elHeader.children[1]);
	}
	console.log("slickdeals+ initialized");
};//main()

if (document.readyState === "complete")
	main();
else
{
	window.addEventListener("DOMContentLoaded", main, false);
	window.addEventListener("load", main, false);
}
// eslint-disable-next-line unicorn/no-array-reduce, arrow-spacing, space-infix-ops, unicorn/prefer-number-properties, unicorn/no-array-for-each, no-shadow, unicorn/prefer-code-point
})("5s6gps68sr1m6j2mfzr02xj92zp02t83c037a8ri2t9o8yq8o932991a66m6k12m".match(/../g).reduce((a,b,c)=>a=[a[0]+String.fromCharCode((c=parseInt(b,36))/a[1]),c%9+1],["",2])[0]);