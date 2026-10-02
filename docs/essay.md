# Can IPFS be a social network?

Every social network I've used is, underneath, a database that belongs to someone else. They decide what stays, what goes, and who gets to see it. I wanted to know what happens if you take the database away.

So I built **graffiti**, a small social app with no server, no database and no accounts. Content lives on [IPFS](https://ipfs.tech/), identity is a keypair, and everything runs in your browser. It has the usual pieces: a profile, posts, a feed, likes, bookmarks and following. Its centrepiece is a pixel-art wall you can paint on, and that other people can tag.

You can [try it in your browser](https://tinpotnick.github.io/graffiti/), and the [code is on GitHub](https://github.com/tinpotnick/graffiti). Be patient on first load. With no servers, your browser has to find other peers before their walls appear, which can take anything from a few seconds to a minute. Why that is, is part of the story.

This isn't a product pitch. It's a thought experiment that happens to run. What I find interesting is the set of problems it exposes.

## Why graffiti?

You may have spotted [*migtherobot*](https://migtherobot.com/) in the screenshots. I love graffiti. When I visited Amman earlier this year, the street art was everywhere, and migtherobot stood out. The robots on my wall are a tribute to their work, and all credit for the character goes to them. Great graffiti can be found all over the world. Back home in the UK, I visited Weston-super-Mare a while ago, where you can spend a good afternoon following the town's graffiti walk.

Graffiti is an old-school social network: art layered on art, carrying social history, politics, or just pure art.

So when I started reading about IPFS and wondering what it could be used for, a wall felt like the obvious test. The app started with your own wall, but once people follow each other it gets social: you can paint on my wall, and I can paint on yours. The same goes for posts, likes and bookmarks.

Scale that up and you get an interesting shape. In theory everyone is connected. In practice you get separate islands, joined wherever one person follows another.

A graffiti wall is a social network in miniature. It's public, anyone can add to it, nobody really owns it, and it changes constantly. That makes it a hard test for a decentralised design, which is exactly what I wanted.

## Two building blocks

IPFS gives you two primitives, and graffiti is built from nothing else.

1. **Immutable, content-addressed files.** A file's address (its CID) is a hash of its contents. Anyone can host it, anyone can verify it, and nobody can change it.
2. **IPNS, a mutable pointer.** A name derived from your public key that you, and only you, can point at a CID.

Your IPNS name *is* your identity and your address. It points at a small JSON manifest:

```
IPNS name (your PeerID)
  └─► root manifest (~1KB)
        ├── tag:       avatar PNG
        ├── posts:     { "2026-03": <CID>, … }   ← monthly buckets
        ├── likes:     { "2026-03": <CID>, … }
        ├── bookmarks: { … }
        └── following: [PeerID, …]
```

Posting means adding a file, updating a bucket, updating the manifest and republishing the pointer. Reading someone's wall means resolving their name and following CIDs. There's no server anywhere in that loop.

One small design choice that mattered: posts and likes are **bucketed by month**. Liking something republishes one small bucket and the 1KB root, not your whole history, and followers who already have older months cached never re-fetch them.

## The interesting one: drawing on a wall you don't own

IPNS is single-writer. Only my key can update my name. So how do *you* paint on *my* wall?

You can't, at least not directly. Instead, when you tag my wall, you publish **only your delta** (the pixels you added) in *your own* space, with a pointer to my wall's CID:

```json
{ "cid": "<your delta>", "wallRef": "<my wall's CID>", "wallBounds": { … } }
```

When anyone views my wall, their app gathers every post it knows about that references my wall, and composites them over the original, oldest first.

Nobody granted anyone write access, and my manifest never changed. Yet the wall fills up.

The consequence surprised me: **there is no canonical wall.** You see the tags from the people *you* follow, and I see the tags from the people *I* follow. Two people looking at "the same" wall see different art. That's either a bug or the most honest model of graffiti I can think of.

Here's how that plays out:

- **A** paints a wall.
- **B** follows A, and paints over part of it.
- **C** follows both A and B, so C sees the wall *with* B's paint on top.
- **A** doesn't follow anyone, so A just sees their own original wall.
- Anyone who can see B's work can paint back over it, including A, if A follows B. The newest layer goes on top, for everyone who follows whoever painted it.

Just like real graffiti, a wall can be painted over. Whether you see the new layer depends on who you're connected to.

One rough edge today: when you paint over a wall, the editor shows you only the original, not the layers already on it, so you're painting over B's work blind. Where it should go is for the editor to show the wall as *you* currently see it, so you can deliberately paint over a specific layer.

It also means I can't remove a tag from my own wall. It isn't mine to remove. Right now, the only control you have is to unfollow the person who tagged you. I actually like that. You can't make something disappear just because you don't like it: there's a cost, because you also lose everything else that person posts. That makes tags sticky, which feels true to real graffiti. Even then, the tag only disappears from *your* view, and anyone who follows the tagger still sees it. In future I could add a way for wall owners to reject a tag and make it disappear, but for now I prefer the version with a cost.

This is [open problem #1](https://github.com/tinpotnick/graffiti/issues/1), and I'd love other people's takes on it.

## Engagement as replication

On IPFS, content only survives if someone pins it. graffiti ties that to social behaviour: when you **bookmark** or **really-like** a post, it's pinned to your pinning service too. Popular content ends up hosted by the people who value it, like a CDN driven by demand.

The flip side is that it makes deletion strange. Which brings me to the problems.

## What's still broken

These are why I'm calling it an experiment.

- **Setup.** Your content only stays online when your app is closed if it's pinned somewhere, which today means signing up for a pinning service and pasting in a token. That's a non-starter for most people. ([#3](https://github.com/tinpotnick/graffiti/issues/3))
- **Speed.** Resolving everyone you follow from a browser node can take seconds to minutes. ([#4](https://github.com/tinpotnick/graffiti/issues/4))
- **Availability.** IPNS records expire. Go offline for a couple of days and your followers can't find you, even though your content is still pinned. This happened to my own account. ([#5](https://github.com/tinpotnick/graffiti/issues/5))
- **Notifications.** If someone you don't follow tags your wall, you have no way of knowing. There's no inbox without a server. ([#2](https://github.com/tinpotnick/graffiti/issues/2))
- **Deletion.** Once content is replicated, "delete" just means "stop pointing at it". The same mechanism that makes popular posts resilient makes regrettable ones permanent. ([#6](https://github.com/tinpotnick/graffiti/issues/6))

And a new problem arrived while I was writing this. At the end of September 2026, the funding for the team maintaining Helia, Kubo and the rest of the core IPFS stack ended, and the free public gateways (`ipfs.io`, `dweb.link`) are being retired. graffiti used those gateways as a fallback. It doesn't any more: it now fetches straight from peers, which works, but it still relies on Protocol Labs' delegated routing service to find those peers quickly. That sharpens the question in the title. It's not just whether IPFS can carry a social network, but whether it can do it without anyone sponsoring the infrastructure in the middle.

## So, can IPFS be a social network?

I don't know. But I like how this little application turned out. It shows that an immutable object store can hold social information, and that the shape of the store dictates how the presentation layer can work. In a lot of ways, those constraints are what make it fun.

There are definitely issues to overcome before this is a usable app. But it can work. The open question is whether it can work *well*. And it does what it set out to do: no social media company gets to decide what you publish. Or rather, what you paint on someone else's wall.

If any of this interests you, the [open problems](https://github.com/tinpotnick/graffiti/labels/open%20problem) are where the fun is. Half-baked ideas are welcome. And if you [try it](https://tinpotnick.github.io/graffiti/), come and tag my wall.
