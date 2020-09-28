// ==UserScript==
// @name        Slickdeals+
// @namespace   V@no
// @description Various enhancements
// @include     https://slickdeals.net/*
// @version     1.7
// @run-at      document-start
// @grant       none
// ==/UserScript==
!function()
{
	if (window.top !== window.self)
		return;

	const linkResolver = "https://unplumb-waves.000webhostapp.com";
	let log = console.log.bind(console),
			linksData = {},
			observer = new MutationObserver(function(mutations, observer)
			{
	//		log("--------", mutations);
				for (let i = 0; i < mutations.length; i++)
				{
					for (let n = 0; n < mutations[i].addedNodes.length; n++)
					{
						getData(mutations[i].addedNodes[n]);
						fixLink(mutations[i].addedNodes[n]);
						getLinks(mutations[i].addedNodes[n]);
					}
				}
			});

	function ls(id, data, stringify)
	{
		let r;
		if (typeof(data) == "undefined")
		{
			if (id in ls.cache)
			{
				r = ls.cache[id];
			}
			else
			{
				r = localStorage.getItem(id);
				if (r !== null)
				{
					try
					{
						r = JSON.parse(r);
						ls.cache[id] = r;
					}
					catch(e)
					{
						log(e);
						log([id, data, r]);
					}
				}
			}
			return r;
		}

		if (!(id in ls.cache))
			ls.cache[id] = [];

		ls.cache[id] = data;
		r = ls.save(id, data, r, stringify);
		return r;
	}
	ls.cache = {};
	ls.max = 50000;//max items to store
	ls.safeKeys = ["options", "dl", "order"];
	ls.save = function(id, data, r, stringify, attempt)
	{
		let d = data;
		if (typeof(data) == "undefined" )
			d = ls.cache[id];

		if (typeof(stringify) == "undefined" || stringify)
			d = JSON.stringify(d);

		try
		{
			r = localStorage.setItem(id, d);
		}
		catch(e)
		{
			ls.purge();
			if (typeof(attempt) == "undefined")
				attempt = 0;
log([attempt, data, e]);

			if (attempt < 100)
				r = ls.save(id, data, r, stringify, ++attempt);

		}
		return r;
	}
	//clear database;
	ls.purge = function()
	{
		let array = Object.keys(localStorage),
				n = 0;

//		while(localStorage.length > ls.max)
		while(n < ls.max)
		{
			let key = array[n++];
			if (!key.match(/^[0-9]+(\-[0-9]+)?([a-z]{3,5})?$/))
				continue;

//log("Deleting " + key + ": " + localStorage.getItem(key));
			return localStorage.removeItem(key);
		}
	}

	function $$(id, node, all)
	{
		try
		{
			if (!node)
				node = document;

			if (!all && id.match(/^[a-zA-Z0-9]/))
				return node.getElementById(id);

			if (all)
				return node.querySelectorAll(id);

			return node.querySelector(id);
		}
		catch(e)
		{
			return undefined;
		}
	}

	function trim(t)
	{
		if (!t)
			return ""+t;

		return (""+t).trim();
	}

	function findParent(node, attr)
	{
		attr = attr || {tagName: "LI"};
		if (!node)
			return node;


		let found = true;
		for(let i in attr)
		{
			if (i == "classList")
			{
				for(let c = 0; c < attr[i].length; c++)
				{
					if (!node.classList.contains(attr[i][c]))
					{
						found = false;
						break;
					}
				}
			}
			else if (typeof(attr[i]) == "object")
			{
				for(let a in attr[i])
				{
					if (node[i][a] != attr[i][a])
					{
						found = false;
						break;
					}
				}
			}
			else
			{
				found = node[i] == attr[i];
			}
			if (!found)
			{
				break;
			}
		}
		if (found)
			return node;

		return findParent(node.parentNode, attr);
	}

	function multiline(func, ws)
	{
		func = func.toString();
		func = func.slice(func.indexOf("/*") + 2, func.lastIndexOf("*/")).split("*//*").join("*/");
		return ws ? func : func.replace(/[\n\t]*/g, "");
	}

	function getData(node)
	{
		let items = $$(".salePrice,.itemPrice,.price", node, true) || [],
				r = [];

		for (let i = 0; i < items.length; i++)
		{
			let itemPrice = items[i],
					parent = itemPrice.parentNode,
					price = trim(itemPrice.innerText),
					priceFree = price && price.match(/or free/i),
					priceNew = price ? ((price.toLowerCase() == "free") ? 0 : (price.match(/^\$/) ? parseFloat(price.replace(/[^0-9.]/g, "")) : NaN)) : NaN,
					priceRetail = parseFloat(trim(($$(".retailPrice", parent) || {}).innerText).replace(/^\$([0-9.]+)/g, "$1")),
					priceOld = parseFloat(trim(($$(".oldListPrice", parent) || {}).innerText).replace(/^\$([0-9.]+)/g, "$1")),
					item = findParent(parent)
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

	//log(price, priceNew, priceRetail, priceOld, itemPrice, item);
		}
		return r;
	}

	function getLinks(node)
	{
		return;
		let obj = $$("[data-pno],[data-threadid],[data-unique-id],[data-outclick-target],[data-product-products]", node, true);
		if (!obj)
			return;

		let types = {
			threadid: "tid",
			uniqueId: "tid",
			outclickTarget: "tid",
			productProducts: "",
			pno: "pno"
		}
		for (let i = 0; i < obj.length; i++)
		{
			let a = obj[i],
					id, type;

			for (let t in types)
			{
				type = types[t];
				if (!type && a.href)
				{
					let m = getIdFromUrl(a.href);
					if (m)
					{
						id = m.id;
						type = m.type;
						break;
					}
				}
				if (id = ~~a.dataset[t])
				{
					break;
				}
			}
			if (!id)
				continue;

			if (ls(id + type))
				continue;

			if (!linksData[id])
			{
				linksData[id] = [a];
				addIframe(id, type, a.href || "");
			}
		}
	}
	
	function getIdFromUrl(url)
	{
		let q = ["pno", "tid", "sdtid"],
				c = {
					sdtid : "tid"
				},
				m;

		for (let t = 0; t < q.length; t++)
		{
			let r = new RegExp("(\\?|(&|&amp;))((" + q[t] + ")=([^&]+))", "i");
			if (m = url.match(r))
				break;
		}
		if (!m)
			return false;

		m[4] = c[m[4]] || m[4];
		let i = url.match(/(\?|(&|&amp;))lno=([0-9]+)/i);
		if (i)
			m[5] += "-" + i[3];
		return {id: m[5], type: m[4]};
	}

	function fixLink(node)
	{
		let links = $$("a", node, true);
		if (!links)
			return;

		for(let i = 0; i < links.length; i++)
		{
			let a = links[i];
			if ("_href" in a)
				continue;

			a._href = a.href;
			m = getIdFromUrl(a.href);
			if (!m)
				continue;

			let aOrig = document.createElement("a");
			aOrig.href = a._href;
			aOrig.className = "origUrl";
			a.appendChild(aOrig);

			let id = m.id,
					type = m.type,
					u = a.href.match(/(\?|&|&amp;)u2=([^&#]*)/i),
					url = u ? decodeURIComponent(u[2]) : ls(id + type);

			if (url)
			{
				if (typeof(url) == "object")
					url = url[0];

				linkUpdate(a, url);
				continue;
			}
			if (!a._resolved)
			{
				a.classList.toggle("alert", true);
				a.classList.toggle("success", false);
			}
			if (!linksData[id])
			{
				linksData[id] = [a];
				addIframe(id, type, a._href);
			}
			if (linksData[id].indexOf(a) == -1)
				linksData[id][linksData[id].length] = a;
		}
	}

	let framesList = {i:0};
	
	function _addIframe(id, type, url)
	{
		let iframe = document.createElement("iframe");
		iframe.id = "iframe" + type + id;
		iframe.src = linkResolver + "/slickdeals/?" + id + "&t=" + type + "&r=" + location.protocol + "//" + location.host + "&u=" + encodeURIComponent(url);
		iframe.style.display = "none";
		document.body.appendChild(iframe);
		framesList.i++;
		return iframe;
	}

	function addIframe(id, type, url)
	{
		let tid = type + id;
		if ((framesList[tid] && framesList[tid].iframe) || ls(id + type))
			return framesList[tid];

		framesList[tid] = {
			id: id,
			type: type,
			url: url,
			iframe: null,
		}
		if (framesList.i < 4)
			framesList[tid].iframe = _addIframe(id, type, url);

		return framesList[tid];
	}

	function linkUpdate(a, url)
	{
		a._resolved = true;
		a.href = url;
		a._hrefNew = url;
		a.classList.toggle("success", true);
		a.classList.toggle("alert", false);
	}

	function receiveMessage(e)
	{
log(arguments);
		if ([linkResolver, "https://slickdeals.net"].indexOf(e.origin) == -1)
		{
log(e);
			return;
		}

		let a,data = JSON.parse(e.data);
		if (!data)
		{
log(e.data);
			return;
		}

		let d = data.url,
				tid = data.type + data.id;

		if (framesList[tid])
		{
			framesList[tid].iframe.parentNode.removeChild(framesList[tid].iframe);
			framesList.i--;
		}
		if (data.url && !data.url.match(/^https:\/\/(www\.)?slickdeals.net/i))
		{
			ls(data.id + data.type, d);
			if (a = linksData[data.id])
			{
				for(let i = 0; i < a.length; i++)
				{
					linkUpdate(a[i], data.url);
				}
			}
		}
		for(let tid in framesList)
		{
			if (framesList[tid].iframe === null)
			{
				addIframe(framesList[tid].id, framesList[tid].type, framesList[tid].url);
				break;
			}
		}
	}

	function main(e)
	{
		window.removeEventListener('DOMContentLoaded', main, false);
		window.removeEventListener('load', main, false);

		let css = document.createElement("style");
		css.innerHTML = multiline(function(){/*
div.free,
li.free
{
	box-shadow: 0 0 10px red;
	background-color: #ffdde0 !important;
}
div.free,
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
	*/});
		document.getElementsByTagName("head")[0].appendChild(css);
		observer.observe(document, {
			subtree: true,
			childList: true
		});
		getData(document);
		fixLink(document);
		getLinks(document);
	}//main()

	if (document.readyState == "complete")
	{
		main();
	}
	else
	{
		window.addEventListener('DOMContentLoaded', main, false);
		window.addEventListener('load', main, false);
	}
	window.addEventListener("message", receiveMessage, false);
}();