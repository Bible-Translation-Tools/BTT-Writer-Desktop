# Change log

## [1.1.0 (build 6)](https://github.com/Bible-Translation-Tools/BTT-Writer-Desktop/releases/tag/v1.1.0)  - latest

#### ADDED:
- Look for user installed fonts - Issue [#8](https://github.com/Bible-Translation-Tools/BTT-Writer-Desktop/issues/8)
- Show translationWords content for languages other than English - PR [#39](https://github.com/Bible-Translation-Tools/BTT-Writer-Desktop/pull/39)

#### FIXED:
- Access token issue: no longer need to manually delete token to login & upload
- Upload existing repo/project error - Issue [#29](https://github.com/Bible-Translation-Tools/BTT-Writer-Desktop/issues/29)
- Could not run on Ubuntu 20.04 - Issue [#12](https://github.com/Bible-Translation-Tools/BTT-Writer-Desktop/issues/12)
 
#### UPDATED:
- **electron** 12.0.0 with **node** 14.16.0 and **chromium** 89.x
- Link to reader after upload - Issue [#16](https://github.com/Bible-Translation-Tools/BTT-Writer-Desktop/issues/16)
- Token name now looks like "**btt-writer-desktop__[YOUR DEVICE NAME]\_[PLATFORM]_[SOME ID]**"

### Security:
 - Please remove the old token named: __ts-desktop__ on WACS

<br>

## [1.0.5 (build 5)](https://github.com/Bible-Translation-Tools/BTT-Writer-Desktop/releases/tag/v1.0.5)
-   Remove restriction so that any source can have resources, not just "ulb" and "obs"
-   Add support for developing using a Docker container