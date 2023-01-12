const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Post, Image, Comment, User, Hashtag } = require('../models');
const { isLoggedIn } = require('./middlewares');

try {
    fs.accessSync('uploads')
} catch (error) {
    console.log('uploads 폴더가 없으므로 생성합니다.');
    fs.mkdirSync('uploads');
}

const upload = multer({
    storage: multer.diskStorage({
        destination(req, file, done) {
            done(null, 'uploads');
        },
        filename(req, file, done) { //제로초.png (시간초붙이기 중복또는 덮어씌우는것을 해결하기위해)
            const ext = path.extname(file.originalname); //확장자 추출
            const basename = path.basename(file.originalname, ext); //제로초
            done(null, basename +'_'+ new Date().getTime() + ext); //제로초15184712891.png
        }
    }),
    limits: { fileSize: 20 * 1024 * 1024 }, //20MB
})

router.post('/', isLoggedIn, upload.none(), async (req, res, next) => {
    try {
        const hashtags = req.body.content.match(/#[^\s#]+/g);
        const post = await Post.create({
            content: req.body.content,
            UserId: req.user.id, //passport덕분에 user에 접근이 가능함
        });
        if (hashtags) {
            //무조건 등록이아닌 이미등록되어있는 값에대해서는 등록안하고 가져옴
            //없는값은 가져옴
            console.log("hashtags = ",hashtags);
            const result = await Promise.all(hashtags.map((tag) => Hashtag.findOrCreate({
                where: { name: tag.slice(1).toLowerCase() }
            }))); // [[노드, true], [리엑트, true]]
            await post.addHashtags(result.map((v) => v[0]));
        }
        if (req.body.image) {
            if (Array.isArray(req.body.image)) { //이미지 여러개
                //시퀄라이즈 Promise all을하여 image 개수만큼 한번 create
                const images = await Promise.all(req.body.image.map((image) => Image.create({src: image})));
                await post.addImages(images);
            } else { //이미지 하나만 올릴떄
                const image = await Image.create({ src: req.body.image });
                await post.addImages(image);
            }
        }
        const fullPost = await Post.findOne({
            where: { id: post.id },
            include: [{
                model: Image,
            },{
                model: Comment,
                include: [{
                    model: User,
                    attributes: ['id','nickname'],
                }]
            },{
                model: User,
                attributes: ['id','nickname'],
            },{
                model: User,
                as: 'Likers',
                attributes: ['id'],
            }]
        })
        res.status(201).json(fullPost);
    } catch (error) {
        console.error(error);
        next(error);
    }

})

router.post('/:postId/comment', isLoggedIn, async (req, res, next) => {
    try {
        const post = await Post.findOne({
            where: { id: req.params.postId }
        });
        if (!post) {
            return res.status(403).send('존재하지 않는 게시글입니다.');
        }
        const comment = await Comment.create({
            content: req.body.content,
            PostId: parseInt(req.params.postId),
            UserId: req.user.id, //passport덕분에 user에 접근이 가능함
        })
        const fullComment = await Comment.findOne({
            where: { id: comment.id },
            include: [{
                model: User,
                attributes: ['id', 'nickname'],
            }],
        })
        res.status(201).json(fullComment);
    } catch (error) {
        console.error(error);
        next(error);
    }
})

router.patch('/:postId/like', isLoggedIn, async (req, res, next) => {
    try {
        const post = await Post.findOne({ where: {id:req.params.postId}})
        if (!post) {
            return res.status(403).send('게시글이 존재하지 않습니다.');
        }
        await post.addLikers(req.user.id);
        res.json({ PostId: post.id, UserId: req.user.id});
    } catch(error) {
        console.error(error);
        next(error);
    }
});

router.delete('/:postId/like', isLoggedIn, async (req, res, next) => {
    try {
        const post = await Post.findOne({ where: {id:req.params.postId}})
        if (!post) {
            return res.status(403).send('게시글이 존재하지 않습니다.');
        }
        await post.removeLikers(req.user.id);
        res.json({ PostId: post.id, UserId: req.user.id});
    } catch(error) {
        console.error(error);
        next(error);
    }
})

router.delete('/:postId', isLoggedIn, async (req, res, next) => {
    try {
         await Post.destroy({
             where: {
                 id: req.params.postId,
                 UserId: req.user.id,
             },
         });
         res.json({ PostId: parseInt(req.params.postId,10) })
    } catch(error) {
        console.error(error);
        next(error);
    }
});

router.post('/images', isLoggedIn, upload.array('image'), async (req, res, next) => {
    res.json(req.files.map((v) => v.filename));
});

router.post('/:postId/retweet', isLoggedIn, async (req, res, next) => {
    try {
        const post = await Post.findOne({
            where: { id: req.params.postId },
            include: [{
                model: Post,
                as: 'Retweet',
            }]
        });

        if (!post) {
            return res.status(403).send('존재하지 않는 게시글입니다.');
        };

        //자기게시글 리트윗 or 자기게시글을 리트윗한것을 리트윗 한거는 막는다
        if (req.user.id === post.UserId || (post.Retweet && post.Retweet.UserId === req.user.id)){
            return res.status(403).send('자신의 글을 리트윗할 수 없습니다.');
        };

        const retweetTargetId = post.RetweetId || post.id;
        const exPost = await Post.findOne({
            where: {
                UserId: req.user.id,
                RetweetId: retweetTargetId,
            }
        });

        if (exPost) {
            return res.status(403).send('이미 리트윗 했습니다.');
        };

        const retweet = await Post.create({
            UserId: req.user.id,
            RetweetId: retweetTargetId,
            content: 'retweet',
        });

        const retweetWithPrevPost = await Post.findOne({
            where: { id: retweet.id },
            include: [{
                model: Post,
                as: 'Retweet',
                include: [{
                    model: User,
                    attributes: ['id', 'nickname'],
                }, {
                    model: Image,
                }]
            }, {
                model: User,
                attributes: ['id', 'nickname'],
            }, {
                model: User, // 좋아요 누른 사람
                as: 'Likers',
                attributes: ['id'],
            }, {
                model: Image,
            }, {
                model: Comment,
                include: [{
                    model: User,
                    attributes: ['id', 'nickname'],
                }],
            }],
        })

        res.status(201).json(retweetWithPrevPost);
    } catch(error) {
        console.error(error);
        next(error);
    }
})

module.exports = router;
