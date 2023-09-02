// ==UserScript==
// @name         Slickdeals+
// @namespace    V@no
// @description  Various enhancements
// @include      https://slickdeals.net/*
// @version      1.10
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function ()
{
if (window.top !== window.self)
	return;

const LocalStorageName = "linksCache";
const linksData = {};
const observer = new MutationObserver(mutations =>
{
//		console.log("--------", mutations);
	for (let i = 0; i < mutations.length; i++)
	{
		for (let n = 0; n < mutations[i].addedNodes.length; n++)
		{
			getData(mutations[i].addedNodes[n]);
			fixLink(mutations[i].addedNodes[n]);
		}
	}
});

const ls = Object.assign(
	(id, data) =>
	{
		if ((data) === undefined)
		{
			return ls.cache[id];
		}

		ls.cache[id] = data;
		return ls.save();
	},
	{
		cache: (() =>
		{
			const returnValue = {};
			try
			{
				Object.assign(returnValue, JSON.parse(localStorage.getItem(LocalStorageName)) || returnValue);
			}
			catch(error)
			{
				console.log(error);
			}
				// upgrade from 1.7
			for(let i = 0, k = Object.keys(localStorage); i < k.length; i++)
			{
				if (!/^\d+(-\d+)?([a-z]{3,5})?$/.test(k[i]))
					continue;

				returnValue[k[i]] = localStorage.getItem(k[i]);
				localStorage.removeItem(k[i]);
			}
			localStorage.setItem(LocalStorageName, JSON.stringify(returnValue));
				// end upgrade
			return returnValue;
		})(),

		max: 2,//max items to store
		save: function (r, attempt)
		{
			try
			{
				r = localStorage.setItem(LocalStorageName, JSON.stringify(ls.cache));
			}
			catch(error)
			{
				ls.purge();
				if ((attempt) === undefined)
					attempt = 0;
				console.log([attempt, error]);

				if (attempt < 100)
					return ls.save(r, ++attempt);

			}
			return r;
		},
			//clear database;
		purge: function ()
		{
			const cache = {};
			const keys = Object.keys(ls.cache);

			for(let i = 0; i < ls.max - 1; i++)
			{
				cache[keys[i]] = ls.cache[keys[i]];
			}
			ls.cache = cache;
		//console.log(ls.cache);
		},
	}
);

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

const trim = t =>
{
	if (!t)
		return "" + t;

	return ("" + t).trim();
};

const findParent = (node, attribute) =>
{
	attribute = attribute || {tagName: "LI"};
	if (!node)
		return node;

	let found = true;
	for(const i in attribute)
	{
		if (i === "classList")
		{
			for(let c = 0; c < attribute[i].length; c++)
			{
				if (!node.classList.contains(attribute[i][c]))
				{
					found = false;
					break;
				}
			}
		}
		else if (typeof(attribute[i]) === "object")
		{
			for(const a in attribute[i])
			{
				if (node[i][a] !== attribute[i][a])
				{
					found = false;
					break;
				}
			}
		}
		else
		{
			found = node[i] === attribute[i];
		}
		if (!found)
		{
			break;
		}
	}
	if (found)
		return node;

	return findParent(node.parentNode, attribute);
};

const getData = node =>
{
	const items = $$(".salePrice,.itemPrice,.price,.bp-p-dealCard_price,.dealCard__price", node, true) || [];
	const r = [];

	for (let i = 0; i < items.length; i++)
	{
		const itemPrice = items[i];
		const parent = itemPrice.parentNode;
		const price = trim(itemPrice.textContent);
		const priceFree = price && price.match(/or free/i);
		// eslint-disable-next-line unicorn/no-nested-ternary
		const priceNew = price ? ((price.toLowerCase() === "free") ? 0 : (/^\$/.test(price) ? Number.parseFloat(price.replace(/[^\d.]/g, "")) : Number.NaN)) : Number.NaN;
		const priceRetail = Number.parseFloat(trim(($$(".retailPrice", parent) || {}).textContent).replace(/^\$([\d.]+)/g, "$1"));
		const priceOld = Number.parseFloat(trim(($$(".oldListPrice", parent) || {}).textContent).replace(/^\$([\d.]+)/g, "$1"));
		const item = findParent(parent)
			|| findParent(parent, {tagName: "DIV", dataset: {type: "fpdeal"}})
			|| findParent(parent, {tagName: "DIV", classList: ["resultRow"]})
			|| findParent(parent, {tagName: "DIV", dataset: {role: "frontpageDealContent"}});

		item && item.classList.toggle("free", (priceNew === 0 || priceFree) ? true : false);

		r[r.length] = {
			item: item,
			price: price,
			priceNew : priceNew,
			priceRetail: priceRetail,
			priceOld: priceOld
		};

	//console.log(price, priceNew, priceRetail, priceOld, itemPrice, item);
	}
	return r;
};

const getIdFromUrl = url =>
{
	const q = ["pno", "tid", "sdtid"];
	const c = {
		sdtid : "tid"
	};
	let m;

	for (let t = 0; t < q.length; t++)
	{
		const r = new RegExp("(\\?|(&|&amp;))((" + q[t] + ")=([^&]+))", "i");
		if ((m = url.match(r)))
			break;
	}
	if (!m)
		return false;

	m[4] = c[m[4]] || m[4];
	const i = url.match(/(\?|(&|&amp;))lno=(\d+)/i);
	if (i)
		m[5] += "-" + i[3];
	return {id: m[5], type: m[4]};
};

const fixLink = node =>
{
	const links = $$("a", node, true);
	if (!links)
		return;

	for(let i = 0; i < links.length; i++)
	{
		const a = links[i];
		if ("_href" in a)
			continue;

		a._href = a.href;
			// a.dataset.href = a.href;
		const m = getIdFromUrl(a.href);
		if (!m)
			continue;

		const aOrig = document.createElement("a");
		aOrig.href = a._href;
		aOrig.className = "origUrl";
		a.append(aOrig);

		const id = m.id;
		const type = m.type;
		const u = a.href.match(/(\?|&|&amp;)u2=([^#&]*)/i);
		let url = u ? decodeURIComponent(u[2]) : ls(id + type);

		if (url)
		{
			if (typeof(url) === "object")
				url = url[0];

			linkUpdate(a, url);
			continue;
		}
		if (!a._resolved)
		{
			a.classList.toggle("alert", true);
			a.classList.toggle("successBtn", false);
		}
		if (!linksData[id])
		{
			linksData[id] = [a];
			resolveUrl(id, type, a._href);
		}
		if (!linksData[id].includes(a))
			linksData[id][linksData[id].length] = a;
	}
};

// eslint-disable-next-line unicorn/no-array-reduce, arrow-spacing, space-infix-ops, unicorn/prefer-number-properties, unicorn/no-array-for-each, no-shadow, unicorn/prefer-code-point
const source = "szdcogvyz19rw0m0zar17qjyux7mlr".match(/.{1,6}/g).reduce((a,b,c,d)=>(c=parseInt(b,36),[24,16,8,0].forEach(b=>(d=c>>b&255,d&&(a+=String.fromCharCode(d)))),a),"");

const resolveUrl = (id, type, url) => fetch(source + "?" + id + "&t=" + type + "&u=" + encodeURIComponent(url))
	.then(r => r.json())
	.then(data =>
	{
		if (data.url && !/^https:\/\/(www\.)?slickdeals.net\/\?/i.test(data.url))
		{
			ls(data.id + data.type, data.url);
			const aLinks = linksData[data.id] || [];
			for(let i = 0; i < aLinks.length; i++)
				linkUpdate(aLinks[i], data.url);
		}
		return data;
	})
	.catch(console.error);

const linkUpdate = (a, url) =>
{
	a._resolved = true;
	a.href = url;
	a._hrefNew = url;
	a.classList.toggle("successBtn", true);
	a.classList.toggle("alert", false);
};

const main = () =>
{
	window.removeEventListener("DOMContentLoaded", main, false);
	window.removeEventListener("load", main, false);

	const isDarkMode = document.body.matches("[class*=darkMode]"); //bp-s-darkMode

	document.body.classList.toggle("darkMode", isDarkMode);
	const css = document.createElement("style");
	css.id = "slickdealsPlus";
	css.innerHTML = `
.successBtn
{
	--buttonBackgroundColor: #14F572;
	color
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
	color: black;
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
	width: 1em;
	height: 1em;
	display: none !important;
}
a.origUrl:before
{
	position: absolute;
	width: 1em;
	height: 1em;
	background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZlcnNpb249IjEuMCIgdmlld0JveD0iMCAwIDI0LjcgMjQuNyI+PGRlZnMvPjxwYXRoIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0ZGRiIgc3Ryb2tlLW1pdGVybGltaXQ9IjEwIiBzdHJva2Utd2lkdGg9IjQiIGQ9Ik0zLjIgMjEuNmgwYTQgNCAwIDAxMC01LjdMNiAxMy4xYTQgNCAwIDAxNS43IDBoMGE0IDQgMCAwMTAgNS43bC0yLjggMi44YTQuMiA0LjIgMCAwMS01LjcgMHpNMTMuMSAxMS43aDBhNCA0IDAgMDEwLTUuN2wyLjgtMi44YTQgNCAwIDAxNS43IDBoMGE0IDQgMCAwMTAgNS43bC0yLjggMi44YTQuMiA0LjIgMCAwMS01LjcgMHoiIG9wYWNpdHk9Ii41Ii8+PHBhdGggZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMDAwIiBzdHJva2UtbWl0ZXJsaW1pdD0iMTAiIHN0cm9rZS13aWR0aD0iMiIgZD0iTTMuMiAyMS42aDBhNCA0IDAgMDEwLTUuN0w2IDEzLjFhNCA0IDAgMDE1LjcgMGgwYTQgNCAwIDAxMCA1LjdsLTIuOCAyLjhhNC4yIDQuMiAwIDAxLTUuNyAwek0xMy4xIDExLjdoMGE0IDQgMCAwMTAtNS43bDIuOC0yLjhhNCA0IDAgMDE1LjcgMGgwYTQgNCAwIDAxMCA1LjdsLTIuOCAyLjhhNC4yIDQuMiAwIDAxLTUuNyAweiIvPjxwYXRoIHN0cm9rZT0iI0ZGRiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbWl0ZXJsaW1pdD0iMTAiIHN0cm9rZS13aWR0aD0iNCIgZD0iTTE2LjYgOC4xbC04LjUgOC41IiBvcGFjaXR5PSIuNSIvPjxwYXRoIHN0cm9rZT0iI0ZGRiIgc3Ryb2tlLW1pdGVybGltaXQ9IjEwIiBzdHJva2Utd2lkdGg9IjQiIGQ9Ik0xNC4zIDEwLjRsLTMuOSAzLjkiLz48cGF0aCBmaWxsPSIjMDA3QUZGIiBzdHJva2U9IiMwMDAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLW1pdGVybGltaXQ9IjEwIiBzdHJva2Utd2lkdGg9IjIiIGQ9Ik0xNi42IDguMWwtOC41IDguNSIvPjwvc3ZnPg==");
	background-position: center;
	background-repeat: no-repeat;
	padding: 0.3em;
	content: "";
	top: 0.2em;
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
`;
	document.head.append(css);
	const elInput = document.createElement("input");
	elInput.type = "checkbox";
	elInput.id = "freeOnly";
	elInput.checked = ls("freeOnly");
	document.body.insertBefore(elInput, document.body.firstChild);
	elInput.addEventListener("input", () => ls("freeOnly", elInput.checked));
	console.log("slickdeals+");
	const header = document.querySelector(".slickdealsHeaderSubNav__items");
	if (header)
	{
			// header.firstChild.firstChild.style.padding = 0;
		const label = document.createElement("label");
		label.setAttribute("for", "freeOnly");
		label.className = "freeonly headingRight";
		const box = document.createElement("li");
		box.className = "slickdealsHeaderSubNav__item";
		box.append(label);
		header.insertBefore(box, header.children[1]);
	}
	getData(document);
	fixLink(document);
	observer.observe(document, {
		subtree: true,
		childList: true
	});
};//main()

if (document.readyState === "complete")
{
	main();
}
else
{
	window.addEventListener("DOMContentLoaded", main, false);
	window.addEventListener("load", main, false);
}
})();