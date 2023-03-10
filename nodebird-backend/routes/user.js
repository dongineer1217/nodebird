const express = require('express');
const bcrypt = require('bcrypt');
const { User, Post } = require('../models');
const passport = require('passport');
const router =  express.Router();

//미들웨어
const { isLoggedIn, isNotLoggedIn } = require('./middlewares');

router.get('/', async (req, res, next) => {
    try {
        console.log(req.headers);
        if (req.user) {
            const fullUserWithoutPassword = await User.findOne({
                where: { id: req.user.id },
                attributes: {
                    exclude: ['password']
                },
                include: [{
                    model: Post,
                    attributes: ['id'],
                }, {
                    model: User,
                    as: 'Followings',
                    attributes: ['id'],
                }, {
                    model: User,
                    as: 'Followers',
                    attributes: ['id'],
                }]
            })
            res.status(200).json(fullUserWithoutPassword);
        }else{
            res.status(200).json(null);
        }
    } catch (error) {
        console.error(error);
        next(error);
    }
})

/**
 * POST user login
 */
router.post('/login', isNotLoggedIn, (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            console.error(err);
            return next(err);
        }
        if (info) {
            //status code 401: 로그인이 잘못되었을때..
            console.log("info.reason = ",info.reason);
            return res.status(401).send(info.reason);
        }
        return req.login(user, async (loginErr) => {
            if (loginErr) {
                console.error(loginErr);
                return next(loginErr);
            }
            const fullUserWithoutPassword = await User.findOne({
                where: { id: user.id },
                attributes: {
                    exclude: ['password']
                },
                include: [{
                    model: Post,
                    attributes: ['id'],
                },{
                    model: User,
                    as: 'Followings',
                    attributes: ['id'],
                }, {
                    model: User,
                    as: 'Followers',
                    attributes: ['id'],
                }]
            })
            return res.status(200).json(fullUserWithoutPassword);
        })
    })(req, res, next);
});

router.post('/logout', isLoggedIn, (req, res) => {
    req.logout();
    req.session.destroy();
    res.send('ok');
})

router.post('/', isNotLoggedIn, async (req, res, next) => {
    try {
        const exUser = await User.findOne({
            where: {
                email: req.body.email,
            }
        });
        //email 중복 체크
        if (exUser) {
            //403 http status : 금지의 의미를 가지고있음
            return res.status(403).send('이미 사용중인 아이디입니다.');
        }
        const hashedPassword = await bcrypt.hash(req.body.password, 12);
        await User.create({
            email: req.body.email,
            nickname: req.body.nickname,
            password: hashedPassword,
        });
        //201 http status : 잘 생성됨의 의미
        res.status(201).send('ok');
    } catch (error) {
        console.error(error);
        next(error); //500 http status (서버에러)
    }
});

router.patch('/nickname', isLoggedIn, async (req, res, next ) => {
    try {
        await User.update({
            nickname: req.body.nickname,
        },{
            where: {id: req.user.id},
        });
        res.status(200).json({nickname: req.body.nickname});
    } catch (error) {
        console.error(error);
        next(error);
    }
})

router.patch('/:userId/follow', isLoggedIn, async (req, res, next ) => {
    try {
        const user = await User.findOne({
            where : { id: req.params.userId }
        });
        if(!user) {
            res.status(403).send('없는 사람을 팔로우하려고 하시네요?');
        }
        await user.addFollowers(req.user.id);
        res.status(200).json({UserId: parseInt(req.params.userId, 10)});
    } catch (error) {
        console.error(error);
        next(error);
    }
});

router.delete('/:userId/follow', isLoggedIn, async (req, res, next ) => {
    try {
        const user = await User.findOne({
            where : { id: req.params.userId }
        });
        if(!user) {
            res.status(403).send('없는 사람을 언팔로우하려고 하시네요?');
        }

        await user.removeFollowers(req.user.id)

        res.status(200).json({UserId: parseInt(req.params.userId, 10)});
    } catch (error) {
        console.error(error);
        next(error);
    }
});

router.get('/followers', isLoggedIn, async (req, res, next ) => {
    try {
        const user = await User.findOne({
            where : { id: req.user.id }
        });
        if(!user) {
            res.status(403).send('없는 사람을 팔로우하려고 하시네요?');
        }
        const followers = await user.getFollowers();
        res.status(200).json(followers);
    } catch (error) {
        console.error(error);
        next(error);
    }
});

router.get('/followings', isLoggedIn, async (req, res, next ) => {
    try {
        const user = await User.findOne({
            where : { id: req.user.id }
        });
        if(!user) {
            res.status(403).send('없는 사람을 팔로우하려고 하시네요?');
        }
        const followings = await user.getFollowings();
        res.status(200).json(followings);
    } catch (error) {
        console.error(error);
        next(error);
    }
});

router.delete('/follower/:userId', isLoggedIn, async (req, res, next ) => {
    try {
        const user = await User.findOne({
            where : { id: req.params.userId }
        });
        if(!user) {
            res.status(403).send('없는 사람을 차단하려고 하시네요?');
        }
        await user.removeFollowings(parseInt(req.user.id, 10))
        res.status(200).json({UserId: parseInt(req.params.userId, 10)});
    } catch (error) {
        console.error(error);
        next(error);
    }
});

module.exports = router;
