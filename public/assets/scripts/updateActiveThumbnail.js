                                    function updateActiveThumbnail() {
                                        const hash = window.location.hash.substring(1);
                                        const thumbnails = document.querySelectorAll('.thumbnail');

                                        // Remove active from all
                                        thumbnails.forEach(el => el.classList.remove('actives'));

                                        // Add active based on hash, fallback to FFA
                                        const activeThumbnail = Array.from(thumbnails).find(el => el.classList.contains(hash)) || document.querySelector('.ffa');
                                        activeThumbnail.classList.add('actives');
                                    }

                                    // Initial check on page load
                                    updateActiveThumbnail();

                                    // Add event listener for hash changes
                                    window.addEventListener('hashchange', updateActiveThumbnail);


                                    // Add event listeners to thumbnails
                                    document.querySelectorAll('.thumbnail').forEach(item => {
                                        item.addEventListener('click', () => {
                                            //Remove active from all
                                            document.querySelectorAll('.thumbnail').forEach(el => el.classList.remove('actives'));

                                            //Add active to clicked
                                            item.classList.add('actives');

                                            //Update the URL hash
                                            window.location.hash = item.classList[1];
                                        });
                                    });