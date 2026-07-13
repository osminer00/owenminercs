#!/usr/bin/env node
/**
 * Assemble Gaming/gaming-memorabilia.html from gallery fragments.
 * Run after: node dev/convert-gaming-memorabilia-media.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const fragments = JSON.parse(
	fs.readFileSync(path.resolve('images/gaming-memorabilia/gallery-fragments.json'), 'utf8'),
);

const html = `<!doctype html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<link rel="preconnect" href="https://fonts.googleapis.com" />
		<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
		<link
			href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;700;800;900&display=swap"
			rel="stylesheet"
		/>
		<link rel="stylesheet" href="../css/owenminercs.css" />
		<link rel="stylesheet" href="../css/bubble-theme-base.css" />
		<link rel="stylesheet" href="../css/bubble-themes/gaming.css" />
		<link rel="icon" href="/images/logo/favicon.ico" sizes="any" />
		<link rel="icon" href="/images/logo/favicon-32.png" type="image/png" sizes="32x32" />
		<link rel="icon" href="/images/logo/favicon-16.png" type="image/png" sizes="16x16" />
		<link rel="apple-touch-icon" href="/images/logo/apple-touch-icon.png" />
		<script async src="https://www.googletagmanager.com/gtag/js?id=G-GYG1QRQ8DY"></script>
		<script>
			window.dataLayer = window.dataLayer || [];
			function gtag() {
				dataLayer.push(arguments);
			}
			gtag('js', new Date());
			gtag('config', 'G-GYG1QRQ8DY');
		</script>
		<title>Gaming memorabilia | Gaming | Owen Miner</title>
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<meta
			name="description"
			content="Childhood gaming memorabilia: GameStop midnight release promo boxes (Assassin's Creed IV and Battlefield 4, 2013), Skyrim display box, Game Informer wall, and a Call of Duty: Black Ops broken disc shrine."
		/>
		<meta
			name="keywords"
			content="gaming memorabilia, GameStop midnight release, Assassin's Creed, Battlefield 4, Skyrim, Game Informer, Call of Duty Black Ops, Owen Miner"
		/>
		<meta name="robots" content="index, follow" />
		<link rel="canonical" href="https://www.owenminercs.com/Gaming/gaming-memorabilia" />
		<script type="application/ld+json">
			{
				"@context": "https://schema.org",
				"@type": "WebPage",
				"@id": "https://www.owenminercs.com/Gaming/gaming-memorabilia#webpage",
				"url": "https://www.owenminercs.com/Gaming/gaming-memorabilia",
				"name": "Gaming memorabilia | Owen Miner",
				"description": "Childhood gaming collectibles: GameStop midnight release promo boxes, Skyrim display, Game Informer magazines, and a Call of Duty: Black Ops disc shrine.",
				"inLanguage": "en",
				"isPartOf": { "@id": "https://www.owenminercs.com/#website" },
				"about": { "@id": "https://www.owenminercs.com/#person" }
			}
		</script>
		<script src="../scripts/components.js" defer></script>
		<script src="../scripts/bubble-scroll.js" defer></script>
		<script src="../scripts/memorabilia-carousel.js" defer></script>
	</head>
	<body
		id="top"
		class="site-card-ui setup-detail-page gaming-memorabilia-page bubble-theme bubble-theme--gaming"
		style="zoom: 95%"
	>
		<div class="bubble-bg" aria-hidden="true">
			<div class="bubble-bg__media">
				<video
					id="bubble-bg-video"
					class="bubble-bg__video"
					autoplay
					muted
					loop
					playsinline
					preload="metadata"
					poster="/images/bubble-themes/gaming/poster.jpg"
				>
					<source src="/images/bubble-themes/gaming/bg.mp4" type="video/mp4" />
				</video>
			</div>
			<div class="bubble-bg__veil"></div>
		</div>
		<shared-header></shared-header>
		<div class="container">
			<div class="intro setup-page-compact">
				<p class="setup-detail__back"><a href="gaming.html">← Gaming</a></p>

				<div class="gallery keep-board-intro memorabilia-hero-panel">
					<h1>Gaming memorabilia</h1>
					<p class="memorabilia-hero-panel__lede">
						Childhood collector pieces I still keep around—GameStop midnight-release promo boxes, magazine
						wall mounts in progress, and a few sentimental game shrines. This page is a personal archive, not a
						shopping guide.
					</p>
				</div>
			</div>

			<section class="hub-content-panel memorabilia-sections" aria-label="Gaming memorabilia collections">
				<article class="memorabilia-section" id="gamestop-midnight-2013">
					<h2>GameStop midnight release (2013)</h2>
					<p>
						These are GameStop promotional boxes from my first—and only—midnight release. I was 13 and went to
						the local GameStop on a school night. <em>Assassin's Creed IV: Black Flag</em> and
						<em>Battlefield 4</em> launched the same night, so the store had TVs and PlayStations set up for
						early play before the official release.
					</p>
					<p>
						My middle-school friends were hyped that I got to stay up until about 1&nbsp;a.m. At the end of the
						night the staff raffled posters and promo boxes by drawing names from a hat. When extras were left
						over, they let me take the rest home—which made the whole night feel even more special.
					</p>

					<h3 class="memorabilia-subsection__title">Assassin's Creed IV promotional boxes</h3>
${fragments.ac}

					<h3 class="memorabilia-subsection__title">Battlefield 4 promotional boxes</h3>
					<p>Same midnight event. The Battlefield 4 boxes and swag from that night.</p>
${fragments.bf}
				</article>

				<article class="memorabilia-section" id="skyrim-promo-box">
					<h2>Skyrim promotional box</h2>
					<p>
						A separate GameStop Skyrim promotional display box I kept from around the same era, another piece of
						that middle-school collector phase.
					</p>
${fragments.skyrim}
				</article>

				<article class="memorabilia-section memorabilia-section--placeholder" id="game-informer-wall">
					<h2>Game Informer wall</h2>
					<p>
						I have a stack of <em>Game Informer</em> magazines I am slowly mounting on the wall. Photos and a
						full layout will go here once the display is finished. Check back for updates.
					</p>
					<div
						class="memorabilia-placeholder"
						role="img"
						aria-label="Game Informer magazine wall display, photos coming soon"
					>
						<span class="memorabilia-placeholder__label">Coming soon</span>
						<span class="memorabilia-placeholder__hint">Magazine wall mount in progress</span>
					</div>
				</article>

				<article class="memorabilia-section memorabilia-section--placeholder" id="black-ops-disc-shrine">
					<h2>Call of Duty: Black Ops broken disc shrine</h2>
					<p>
						<em>Call of Duty: Black Ops</em> was one of my favorite games growing up. I played it so much that the
						disc eventually cracked from being popped in and out of the case over and over. Instead of throwing
						it away, I kept it as a small display—a sentimental shrine to how much time I spent in that game.
					</p>
${fragments['black-ops']}
				</article>
			</section>
		</div>

		<shared-footer
			disclosure="<i>This page has no paid shopping links. Gear, Keyboard, and PC pages may include Amazon affiliate links.</i>"
		></shared-footer>
	</body>
</html>
`;

const outPath = path.resolve('Gaming/gaming-memorabilia.html');
fs.writeFileSync(outPath, html);
console.log('Wrote', outPath);
