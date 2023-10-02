<style type="text/css">
fixed::before,
changed::before,
removed::before,
added::before,
unknown::before
{
font-family: monospace;
width: 1em;
display: inline-block;
line-height: 1em;
vertical-align: middle;
font-weight: bold;
font-size: 1.2em;
margin-left: -1em;
}
fixed::before
{
content: "! ";
color: orange;
}
changed::before
{
content: "* ";
color: lightblue;
height: 1em;
line-height: 1.2em;
}
removed::before
{
content: "- ";
color: red;
}
added::before
{
content: "+ ";
color: green;
}
unknown::before
{
content: "? ";
color: grey;
opacity: 0.5;

}
date
{
font-size: 0.8em;
color: grey;
opacity: 0.8;
font-style: italic;
line-height: 1em;
height: 1.2em;
display: inline-block;
vertical-align: middle;
}
ul
{
margin-left: 1em;
}
li { list-style: none }
p {margin-bottom: 0 !important;}
details
{
font-size: 0.8em;
float: right;
line-height: 4em;
position: absolute;
top: 0;
right: 2.2em;
opacity: 0.4;
transition: opacity 0.7s ease-in-out;
}
details[open]
{
position: fixed;
background-color: var(--bgColor-default, var(--color-canvas-default));
border: 1px solid var(--borderColor-muted, var(--color-border-muted));
top: 0.5em;
right: 0.5em;
padding: 1em;
z-index: 1;
opacity: 1;
}
details[open] > summary
{
line-height: 1em;
margin: 0.0em 0 1em;
text-align: center;
}
summary
{
color: grey;
}

details > div
{
line-height: 1.2em;
}
details > div > *::before
{
margin-left: 0;
}</style>
<details><summary>Legend</summary><div><added></added>Added<br><changed></changed>Changed<br><fixed></fixed>Fixed<br><removed></removed>Removed</div></details>

# Changes Log

**[23.10.1-222851](https://github.com/vanowm/slickdealsPlus/commit/)** <date>(2023-10-02 02:28:51)</date>
* <added title="Added">custom CSS (user can modify CSS)</added>

**[23.10.1-52441](https://github.com/vanowm/slickdealsPlus/commit/dd351dd)** <date>(2023-10-01 05:24:41)</date>
* <added title="Added">changes log from previous version</added>
* <added title="Added">clicking on update banner opens menu with changes log</added>

**[23.9.28-93039](https://github.com/vanowm/slickdealsPlus/commit/39a69c9)** <date>(2023-09-28 14:31:02)</date>
* <changed title="Changed">versioning to yy.m.d-Hmmss format</changed>

**[23.9.28011831](https://github.com/vanowm/slickdealsPlus/commit/50dae16)** <date>(2023-09-28 05:23:34)</date>
* <added title="Added">Option to show/hide price difference</added>
* <added title="Added">Option to highlight items with certain price difference</added>
* <changed title="Changed">changed versioning to CalVer</changed>
* <changed title="Changed">Price difference moved below the price</changed>

**[1.21.3](https://github.com/vanowm/slickdealsPlus/commit/a95ad1d)** <date>(2023-09-27 13:45:29)</date>
* <fixed title="Fixed">long price line would break the card</fixed>

**[1.21.2](https://github.com/vanowm/slickdealsPlus/commit/29d8521)** <date>(2023-09-26 04:22:38)</date>
* <added title="Added">update notification banner</added>
* <added title="Added">current version indicator in the menu</added>
* <fixed title="Fixed">wrong colors some menu items with default theme</fixed>

**[1.21.1](https://github.com/vanowm/slickdealsPlus/commit/70732c9)** <date>(2023-09-26 02:13:22)</date>
* <changed title="Changed">improved percent display</changed>

**[1.21](https://github.com/vanowm/slickdealsPlus/commit/4724d1e)** <date>(2023-09-25 03:56:50)</date>
* <added title="Added">added jsdocs</added>

**[1.21](https://github.com/vanowm/slickdealsPlus/commit/f6bb031)** <date>(2023-09-25 03:30:18)</date>
* <added title="Added">item highlighting with user selected score</added>
* <changed title="Changed">revamped settings</changed>
* <fixed title="Fixed">"$xx OFF" showed wrong discount</fixed>

**[1.20](https://github.com/vanowm/slickdealsPlus/commit/d75c7a1)** <date>(2023-09-24 16:32:49)</date>
* <changed title="Changed">changed API request format</changed>
* <changed title="Changed">settings classes are set on html element</changed>

**[1.19](https://github.com/vanowm/slickdealsPlus/commit/6c2ddeb)** <date>(2023-09-24 05:16:10)</date>
* <added title="Added">block image trackers</added>
* <added title="Added">price difference/percent for "$xx off $yy"</added>
* <changed title="Changed">only show blocked messages in debug</changed>
* <changed title="Changed">API response changed to binary format</changed>
* <fixed title="Fixed">debug option unintentionally shown if no settings were prev. saved</fixed>

**[1.18.5](https://github.com/vanowm/slickdealsPlus/commit/4ce51c0)** <date>(2023-09-19 02:59:38)</date>
* <changed title="Changed">small optimizations</changed>

**[1.18.4](https://github.com/vanowm/slickdealsPlus/commit/6398782)** <date>(2023-09-18 01:22:11)</date>
* <added title="Added">Prices tooltip</added>
* <fixed title="Fixed">Some cards were not properly displayed</fixed>

**[1.18.3](https://github.com/vanowm/slickdealsPlus/commit/654f09f)** <date>(2023-09-13 04:12:55)</date>
* <changed title="Changed">debug option shows if debug is set to 0 or 1</changed>
* <fixed title="Fixed">ad banner on top</fixed>

**[1.18.2](https://github.com/vanowm/slickdealsPlus/commit/3721e72)** <date>(2023-09-12 04:45:02)</date>
* <fixed title="Fixed">error on vote</fixed>

**[1.18.1](https://github.com/vanowm/slickdealsPlus/commit/a834ced)** <date>(2023-09-11 16:33:23)</date>
* <changed title="Changed">debug messages format</changed>

**[1.18](https://github.com/vanowm/slickdealsPlus/commit/3a881d8)** <date>(2023-09-11 15:02:57)</date>
* <fixed title="Fixed">script sometimes fails initializing</fixed>
* <fixed title="Fixed">menu sometimes not shown</fixed>
* <changed title="Changed">simplified menu item creation</changed>

**[1.17.4](https://github.com/vanowm/slickdealsPlus/commit/980fc16)** <date>(2023-09-11 12:21:00)</date>
* <changed title="Changed">ad blocking in fetch now responds with ""</changed>

**[1.17.3](https://github.com/vanowm/slickdealsPlus/commit/48cb014)** <date>(2023-09-11 11:47:34)</date>
* <changed title="Changed">optimized proceedMarker usage</changed>

**[1.17.2](https://github.com/vanowm/slickdealsPlus/commit/0d688a6)** <date>(2023-09-11 11:39:42)</date>
* <fixed title="Fixed">cache keys were added as class name</fixed>
* <changed title="Changed">processedMarker as single character</changed>

**[1.17.1](https://github.com/vanowm/slickdealsPlus/commit/f63eda9)** <date>(2023-09-10 20:44:17)</date>
* <added title="Added">minor optimization</added>

**[1.17](https://github.com/vanowm/slickdealsPlus/commit/f3d787d)** <date>(2023-09-10 20:22:09)</date>
* <added title="Added">more comprehensive ad-blocker</added>
* <fixed title="Fixed">menu properly opens and closes</fixed>
* <fixed title="Fixed">dynamic links not resolved (i.e coupon links)</fixed>

**[1.16.3](https://github.com/vanowm/slickdealsPlus/commit/52b997d)** <date>(2023-09-08 16:44:44)</date>
* <added title="Added">added resolving links count to the loading icon</added>

**[1.16.2](https://github.com/vanowm/slickdealsPlus/commit/3f73a8a)** <date>(2023-09-05 18:21:46)</date>
* <fixed title="Fixed">fixed delay before menu appears</fixed>

**[1.16.1](https://github.com/vanowm/slickdealsPlus/commit/00de519)** <date>(2023-09-05 18:07:32)</date>
* <fixed title="Fixed">fixed loading icon in collapsed menu</fixed>

**[1.16](https://github.com/vanowm/slickdealsPlus/commit/4cc6a60)** <date>(2023-09-05 16:57:08)</date>
* <added title="Added">ad block option</added>
* <added title="Added">moved all options into dropdown menu</added>

**[1.15.2](https://github.com/vanowm/slickdealsPlus/commit/969c3c4)** <date>(2023-09-05 11:41:30)</date>
* <fixed title="Fixed">prices such as ~$123 were not recognized.</fixed>

**[1.15.1](https://github.com/vanowm/slickdealsPlus/commit/7d335a6)** <date>(2023-09-05 02:12:31)</date>
* <added title="Added">moved css to the end</added>

**[1.15](https://github.com/vanowm/slickdealsPlus/commit/72c4a9b)** <date>(2023-09-05 01:53:02)</date>
* <added title="Added">hour glass icon displayed while links are being resolved.</added>
* <removed title="Removed">Removed "Show resolved" option.</removed>
* <changed title="Changed">Resolved links are green now</changed>
* <changed title="Changed">Links only resolved if  "Resolved links" option is enabled.</changed>
* <changed title="Changed">Overlay link icon only shown when resolved/original link is available</changed>

**[1.14](https://github.com/vanowm/slickdealsPlus/commit/e03767a)** <date>(2023-09-04 20:01:48)</date>
* <added title="Added">API request to changed to POST</added>

**[1.13.1](https://github.com/vanowm/slickdealsPlus/commit/82b0a7b)** <date>(2023-09-04 00:45:57)</date>
* <added title="Added">Update README.md</added>

**[1.13.1](https://github.com/vanowm/slickdealsPlus/commit/b4a47d0)** <date>(2023-09-04 00:45:33)</date>
* <added title="Added">Create README.md</added>

**[1.13.1](https://github.com/vanowm/slickdealsPlus/commit/e838c5a)** <date>(2023-09-04 00:41:46)</date>


**[1.13](https://github.com/vanowm/slickdealsPlus/commit/7542df7)** <date>(2023-09-04 00:19:14)</date>
* <added title="Added">added options checkboxes</added>
* <added title="Added">fixed some pages not parsed</added>

**[1.12](https://github.com/vanowm/slickdealsPlus/commit/be34cb1)** <date>(2023-09-03 05:50:15)</date>
* <added title="Added">title on original links</added>

**[1.12](https://github.com/vanowm/slickdealsPlus/commit/2dd07c3)** <date>(2023-09-03 05:47:37)</date>
* <added title="Added">wrapped price diff. was overlapping line below</added>

**[1.11](https://github.com/vanowm/slickdealsPlus/commit/bc8942a)** <date>(2023-09-03 05:17:21)</date>
* <added title="Added">added license</added>

**[1.11](https://github.com/vanowm/slickdealsPlus/commit/9cf7cdc)** <date>(2023-09-03 05:11:59)</date>
* <added title="Added">display price difference and %</added>

**[1.11](https://github.com/vanowm/slickdealsPlus/commit/e97085a)** <date>(2023-09-03 04:49:52)</date>
* <added title="Added">optimized script</added>

**[1.10](https://github.com/vanowm/slickdealsPlus/commit/b2b9f35)** <date>(2023-09-02 15:46:00)</date>
* <added title="Added">new</added>

**[1.9](https://github.com/vanowm/slickdealsPlus/commit/ff99192)** <date>(2021-11-23 23:09:51)</date>


**[1.9](https://github.com/vanowm/slickdealsPlus/commit/acfd041)** <date>(2021-11-21 14:14:04)</date>
* <added title="Added">dark theme detection</added>

**[1.8](https://github.com/vanowm/slickdealsPlus/commit/d888b70)** <date>(2021-10-28 01:18:54)</date>


**[1.7](https://github.com/vanowm/slickdealsPlus/commit/9ae42fb)** <date>(2020-09-28 03:39:23)</date>
* <added title="Added">original link as icon on mouse over a link</added>
* <changed title="Changed">links that are not yet resolved shown in red</changed>

**[1.6.4](https://github.com/vanowm/slickdealsPlus/commit/18ed4d5)** <date>(2020-05-13 03:37:39)</date>


**[1.6.3](https://github.com/vanowm/slickdealsPlus/commit/88d5972)** <date>(2020-05-11 12:32:26)</date>


**[1.6.2](https://github.com/vanowm/slickdealsPlus/commit/ba9ffa2)** <date>(2020-05-11 01:27:10)</date>


**[1.6.1](https://github.com/vanowm/slickdealsPlus/commit/205c570)** <date>(2020-05-10 23:37:39)</date>


**[1.6](https://github.com/vanowm/slickdealsPlus/commit/c5b854a)** <date>(2020-05-10 23:05:32)</date>


**[1.5.3](https://github.com/vanowm/slickdealsPlus/commit/07d9f6b)** <date>(2020-05-10 13:15:07)</date>


**[1.5.1](https://github.com/vanowm/slickdealsPlus/commit/5dd0a4f)** <date>(2020-05-10 12:54:48)</date>


**[1.5](https://github.com/vanowm/slickdealsPlus/commit/f41b04c)** <date>(2020-05-10 12:44:39)</date>


**[1.4](https://github.com/vanowm/slickdealsPlus/commit/cbdf6e1)** <date>(2020-05-10 12:03:43)</date>


**[1.3](https://github.com/vanowm/slickdealsPlus/commit/0ef2703)** <date>(2020-05-09 18:37:57)</date>


**[1.2](https://github.com/vanowm/slickdealsPlus/commit/10b1509)** <date>(2020-05-09 15:52:52)</date>


