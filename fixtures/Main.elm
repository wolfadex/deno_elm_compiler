module Main exposing (main)

import Platform


main : Program () {} msg
main =
    Platform.worker
        { init = \_ -> ( {}, Debug.log "carl" Cmd.none )
        , subscriptions = \_ -> Sub.none
        , update = \_ model -> ( model, Cmd.none )
        }
