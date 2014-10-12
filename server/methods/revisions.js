Meteor.methods({
	revisionsAnimeAdd: function(anime) {

		// Ensure integerity of data
		check(anime, AnimeRevisionsSchema);

		// Get auto values
		anime.slug = getSlug(anime.canonicalTitle);
		anime.createdAt = new Date();

		// Ensure uniqueness
		var titleCheck = Anime.findOne({canonicalTitle: anime.canonicalTitle});
		var slugCheck = Anime.findOne({slug: anime.slug});

		var uniqueCondition;

		if (titleCheck || slugCheck) {
			uniqueCondition = false;
			throw new Meteor.Error(403, "The canonical title of the anime was found in our database");

		} else {
			uniqueCondition = true;
		}

		// We want the anime to be unique and the user to be logged in
		// before we add in the revision
		if (uniqueCondition && Meteor.user()) {

			var revisionAnime = Revisions.createRevisionObject('Anime', 'Addition', Meteor.user()._id, Meteor.user().username, anime);

			// Insert the document into the database
			Revisions.insert(revisionAnime, function(error, _id) {
				console.log(_id);
			});

		}


	},
	revisionsAnimeAddEdit: function(anime) {

		// The edited version of the anime is sent
		check(anime, AnimeRevisionsSchema);
		console.log(anime);
		
		var oldAnime = Anime.findOne({_id: anime._id});
		var uniqueCondition;

		console.log(oldAnime);

		var changedAttributesAnime = {};
		// Let's add anime entries that changed
		for (var key in anime) {
			if (anime.hasOwnProperty(key)) {
				if (!_.isEqual(anime[key], oldAnime[key])) {
					changedAttributesAnime[key] = anime[key];
				}
			}
		}

		// Add the _id, that can't change but we'll need it for staying connected with the anime 
		changedAttributesAnime._id = oldAnime._id;

		// if the canonicalTitle of the anime was changed...
		if (changedAttributesAnime.canonicalTitle) {

			// We'll need to regenerate the slug since the title changed
			changedAttributesAnime.slug = getSlug(anime.canonicalTitle);

			// Ensure uniqueness
			var titleCheck = Anime.findOne({canonicalTitle: changedAttributesAnime.canonicalTitle});
			var slugCheck = Anime.findOne({slug: changedAttributesAnime.slug});


			if (titleCheck || slugCheck) {
				uniqueCondition = false;
				throw new Meteor.Error(403, "The canonical title of the anime was found in our database");

			} else {
				uniqueCondition = true;
			}

		} else {
			uniqueCondition = true;
		}

		// We also want to know if the coverImageChanged

		if (changedAttributesAnime.coverImage) {
			// First of all this means that now coverImage contains a URL
			// additionally we'll now use the new url format 
			changedAttributesAnime.newImageURLFormat = true;
		}

		if (_.isEmpty(changedAttributesAnime)) {
			throw new Meteor.Error(403, "Nothing was changed, revision not committed");
		}

		// We want the anime to be unique and the user to be logged in
		// and ensure the we actually had some changed attributes
		// before we add in the revision
		if (uniqueCondition && Meteor.user() && !_.isEmpty(changedAttributesAnime)) {

			console.log(changedAttributesAnime);

			var revisionAnime = Revisions.createRevisionObject('Anime', 'Revision', Meteor.user()._id, Meteor.user().username, changedAttributesAnime);

			// Insert the document into the database
			Revisions.insert(revisionAnime, function(error, _id) {
				console.log(_id);
			});

		}


	},
	revisionsAnimeUpdate: function(anime) {

		// Ensure integerity of data
		check(anime, AnimeRevisionsSchema);

		// If revision is an Addition (updated), we need to check for uniqueness

		// if anime._id exists than this anime already is in the database
		// in which case this is a revision, else it's an addition (updated)
		// we do revision updates in another method
		if (!anime._id) {

			var titleCheck = Anime.findOne({canonicalTitle: anime.canonicalTitle});
			var slugCheck = Anime.findOne({slug: getSlug(anime.canonicalTitle)});
			var uniqueCondition;

			if (titleCheck || slugCheck) {
				uniqueCondition = false;
				throw new Meteor.Error(403, "The canonical title of the anime was found in our database");
			} else {
				uniqueCondition = true;
			}

			if (uniqueCondition && Meteor.user()) {

				Revisions.update({_id: anime.revisionId}, {$set: {content: anime}}, function(error, num) {
					if (error)
						throw new Meteor.Error(403, error.reason);

				});

			}
		}


	},
	revisionAnimeUpdateEdit: function(anime) {

		// Checks don't work properly currently, since 
		// we are sending a subset of the anime document

		// Ensure integrity of data 
		// check(anime, AnimeRevisionsSchema);


		// currently, you can only update a revision if you're a moderator
		if (Meteor.user().isModerator()) {
			Revisions.update({_id: anime.revisionId}, {$set: {content: anime}}, function(error, num) {
				if (error)
					throw new Meteor.Error(403, error.reason);

			});			
		}

	},

	// Revision Approved 
	revisionApproved: function(revision) {

		// We should actually be pulling the revision from the database
		// to ensure the revision object itself hasn't been screwed up
		// during transmision. For now, we'll leave it be.

		// If the user isn't a moderator 
		// they cannot approve revisions
		if (!Meteor.user().isModerator())
			throw new Meteor.Error(403, "Only moderators are allowed to approve revisions");

		// Anime Additions should work
		if (revision.contentType === 'Anime') {


			// We can basically insert 
			if (revision.type === 'Addition') {
				// revision.content contains the anime object

				// We'll just throw it in the createAnimeObject method to generate the default fields
				var animeObject = Anime.createAnimeObject(revision.content);

				// If coverImage exists we should add in the new url image format field
				if (animeObject.coverImage) {
					animeObject.newImageURLFormat = true;
				}

				// Ensure uniqueness
				var titleCheck = Anime.findOne({canonicalTitle: animeObject.canonicalTitle});
				var slugCheck = Anime.findOne({slug: animeObject.slug});

				var uniqueCondition;

				if (titleCheck || slugCheck) {
					uniqueCondition = false;
				} else {
					uniqueCondition = true;
				}

				if (uniqueCondition) {

					var animeId = Anime.insert(animeObject);

					// We only want to initiate the image upload if 
					// there was an image url provided
					if (animeId && animeObject.coverImage) {
						console.log('we\'re about to upload the image');
						Meteor.call("uploadImageFromUrl", animeObject.coverImage, 'anime', 'cover', animeId, function(error, result) {
							if (error) {
								throw new Meteor.Error(403, error.reason);
							}
						});
					}

					// Update the user's positive scoring
					Meteor.users.update({_id: revision.userId}, {$inc: {revisionsApprovedCount: 1}});


					// We also update the revision's status to Approved here
					Revisions.update({_id: revision._id}, {$set: {status: "Approved", descicionByUsername: Meteor.user().username, descionByUserId: Meteor.user()._id}});

					return animeId;
				} else {
					throw new Meteor.Error(403, 'Anime is not unique');
				}
			}

			// These are for edits of existing anime
			if (revision.type === 'Revision') {
				// let's check if we need to do a unique check
				// unique check is only necessary if the canonicalTitle exists
				var uniqueCondition;
				if (revision.content.canonicalTitle) {
					// Ensure uniqueness
					revision.content.slug = getSlug(revision.content.canonicalTitle);

					var titleCheck = Anime.findOne({canonicalTitle: revision.content.canonicalTitle});
					var slugCheck = Anime.findOne({slug: revision.content.slug});

					var uniqueCondition;

					if (titleCheck || slugCheck) {
						uniqueCondition = false;
					} else {
						uniqueCondition = true;
					}
				
				} else {
					uniqueCondition = true;
				}	

				// only do the update, if we find it's unique
				if (uniqueCondition) {

					// if coverImage exists, then we should also 
					// add that we'll be using the new url format for
					// the image
					if (revision.content.coverImage) 
						revision.content.newImageURLFormat = true;


					console.log(revision.content);

					// We update before, since uploadImageFromUrl will also be doing an anime update of it's own
					Anime.update({_id: revision.content._id}, {$set: revision.content});

					// Check if we have coverImage, if we do, we assume it's a url and then try to upload it
					if (revision.content.coverImage && revision.content._id) {

						console.log('we\'re about to upload the image');
						Meteor.call("uploadImageFromUrl", revision.content.coverImage, 'anime', 'cover', revision.content._id, function(error, result) {
							if (error) {
								throw new Meteor.Error(403, error.reason);
							}
						});					
					}

					// Update the user's positive scoring
					Meteor.users.update({_id: revision.userId}, {$inc: {revisionsApprovedCount: 1}});


					// We also update the revision's status to Approved here
					Revisions.update({_id: revision._id}, {$set: {status: "Approved", descicionByUsername: Meteor.user().username, descionByUserId: Meteor.user()._id}});

				} else {
					throw new Meteor.Error(403, 'Anime is not unique');
				}
			}


		}
	
	},

	revisionDeclined: function(revision) {
		// Increase the declined revision count first
		Meteor.users.update({_id: revision.userId}, {$inc: {revisionDeclinedCount: 1}});

		// Update the revision's status to declined
		Revisions.update({_id: revision._id}, {$set: {status: "Declined", descicionByUsername: Meteor.user().username, descionByUserId: Meteor.user()._id}});
	},

	revisionReopen: function(revision) {
		// Increase the declined revision count first

		// if the revision was declined before, we should remove a point from declined count, since we're re-opening it.
		if (revision.status === 'Declined') {
			Meteor.users.update({_id: revision.userId}, {$inc: {revisionDeclinedCount: -1}});
		} else if (revision.status === 'Approved') {
			// You can't Open an Approved revision, however, if that functionality is ever added 
			// this will remove 1 from approved count
			Meteor.users.update({_id: revision.userId}, {$inc: {revisionApprovedCount: -1}});
		}

		// Update the revision's status to declined
		Revisions.update({_id: revision._id}, {$set: {status: "Open", descicionByUsername: Meteor.user().username, descionByUserId: Meteor.user()._id}});

	}
});