'use strict';

const _ = require('lodash'),
    fs = require('fs'),
    path = require('path'),
    utils = require('../js/lib/utils'),
    AdmZip = require('adm-zip'),
    mkdirp = require('mkdirp'),
    os = require('os'),
    princePackager = require('../js/prince-packager'),
    Prince = require('prince');

function PrintManager(configurator, i18n) {

    const download = utils.download;
    const srcDir = path.resolve(path.join(__dirname, '..'));
    const imageRoot = path.join(configurator.getValue('rootdir'), 'images');
    const imagePath = path.join(imageRoot, 'obs');
    const zipPath = path.join(imageRoot, 'obs-images.zip');
    const server = configurator.getUserSetting("mediaserver");
    const url = server + 'obs/jpg/1/en/obs-images-360px.zip';

    return {

        downloadImages: function () {
            return utils.fs.mkdirs(imagePath)
                .then(function () {
                    return utils.fs.stat(zipPath).then(utils.ret(true)).catch(utils.ret(false));
                })
                .then(function (fileExists) {
                    return fileExists ? true : download(url, zipPath, true);
                });
        },

        extractImages: function () {
            const zip = new AdmZip(zipPath);
            zip.extractAllTo(imagePath, true);

            const directories = fs.readdirSync(imagePath).filter(function (file) {
                return fs.statSync(path.join(imagePath, file)).isDirectory();
            });
            directories.forEach(function (dir) {
                const dirPath = path.join(imagePath, dir);
                const files = fs.readdirSync(dirPath);
                files.forEach(function (file) {
                    const filePath = path.join(imagePath, dir, file);
                    const newPath = path.join(imagePath, file);
                    fs.renameSync(filePath, newPath);
                });
                fs.rmdirSync(dirPath);
            });
        },

        savePdf: function (resource, title, license, body, filePath, direction) {
            const fontSizeMap = {
                'small': '50%',
                'normal': '100%',
                'large': '150%'
            };
            const tempPath = configurator.getValue('tempDir');
            const input = path.join(tempPath, 'print.html');
            const cssPath = path.join(srcDir, 'css', 'print.css');
            const font = configurator.getUserSetting('targetfont').name;
            const sizeValue = configurator.getUserSetting('targetsize').name.toLowerCase();
            const size = fontSizeMap[sizeValue];
            const mainheader = '\<!DOCTYPE html\>\<html\>\<head\>\<link rel="stylesheet" href="' + cssPath + '"\>\<\/head\>\<body\>';
            const mainfooter = '\<\/body\>\<\/html\>';
            const resourcegroup = '\<h1 id="resource" class="titles" style="font-family: ' + font + ';"\>' + resource + '\<\/h1\>';
            const titlegroup = '\<h1 id="title" class="break" style="font-family: ' + font + ';"\>' + title + '\<\/h1\>';
            const licensegroup = '\<div id="license" class="break"\>' + license + '\<\/div\>';
            const bodygroup = '\<div id="textholder" dir="'+direction+'" style="font-family: ' + font + '; font-size: ' + size + ';"\>' + body + '\<\/div\>';

            const princeInfo = princePackager.info(os.platform());

            mkdirp.sync(tempPath);
            fs.writeFileSync(input, mainheader + resourcegroup + titlegroup + licensegroup + bodygroup + mainfooter);

            // Instead of returning custom prince's promise,
            // we return native Promise to be able to pass through context bridge
            return Promise.resolve(
                Prince()
                    .binary(path.join(srcDir, 'prince', princeInfo.binary))
                    .prefix(path.join(srcDir, 'prince', princeInfo.prefix))
                    .inputs(input)
                    .output(filePath)
                    .execute()
                    .catch(function (err) {
                        return utils.fs.remove(tempPath)
                            .then(function () {
                                if (err.stderr.includes("Permission denied")) {
                                    throw i18n.translate("write_to_file_failed");
                                } else {
                                    console.log(err);
                                    throw i18n.translate("create_file_failed");
                                }
                            });
                    })
                    .then(function () {
                        return utils.fs.remove(tempPath);
                    })
            );
        },

        getLicense: function (filename) {
            const locale = i18n.getLocale().code;
            return fs.readFileSync(path.join(srcDir, 'assets', 'licenses', locale, filename), 'utf8');
        },
    };
}

module.exports.PrintManager = PrintManager;
